import { notFound } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canManage, canRead } from '@/lib/authz'
import { PartenairesView } from './partenaires-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function PartenairesPage({ params }: PageProps) {
  const { id } = await params

  const session = await auth()
  if (!session?.user?.id) notFound()
  const access = await getEventAccess(session.user.id, id)
  if (!canRead(access)) notFound()

  const event = await db.event.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      location: true,
      date: true,
      user: { select: { id: true, name: true, email: true } },
    },
  })
  if (!event) notFound()

  const partners = await db.partner.findMany({
    where: { eventId: id },
    orderBy: [{ createdAt: 'asc' }],
  })

  // People a partner can be assigned to: the owner (organiser) + bureau members.
  const memberRows = await db.eventMember.findMany({
    where: { eventId: id },
    select: { id: true, name: true, userId: true },
    orderBy: { name: 'asc' },
  })
  const ownerIsMember = memberRows.some((m) => m.userId === event.user.id)
  const members = [
    ...(ownerIsMember ? [] : [{ id: event.user.id, name: event.user.name || event.user.email }]),
    ...memberRows.map((m) => ({ id: m.id, name: m.name })),
  ]

  return (
    <PartenairesView
      event={{
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date ? event.date.toISOString() : null,
      }}
      initialPartners={partners.map((p) => {
        let contributions: string[] = []
        try {
          contributions = JSON.parse(p.contributions) as string[]
        } catch {
          contributions = []
        }
        return {
          id: p.id,
          name: p.name,
          kind: p.kind,
          status: p.status,
          contactName: p.contactName,
          email: p.email,
          phone: p.phone,
          note: p.note,
          contributions,
          amount: p.amount,
          responsibleId: p.responsibleId,
          nextContactDate: p.nextContactDate ? p.nextContactDate.toISOString() : null,
          wish: p.wish,
        }
      })}
      members={members}
      canEdit={canManage(access)}
    />
  )
}
