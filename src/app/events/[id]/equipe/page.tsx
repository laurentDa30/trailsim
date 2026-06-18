import { notFound } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canManage, canRead } from '@/lib/authz'
import { EquipeView } from './equipe-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EquipePage({ params }: PageProps) {
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
      targetVolunteers: true,
      user: { select: { name: true, email: true } },
      races: { select: { id: true, name: true, color: true, distance: true }, orderBy: { startTime: 'asc' } },
    },
  })
  if (!event) notFound()

  const [members, partners, sections] = await Promise.all([
    db.eventMember.findMany({
      where: { eventId: id },
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    }),
    db.partner.findMany({
      where: { eventId: id },
      orderBy: [{ kind: 'asc' }, { createdAt: 'asc' }],
    }),
    db.section.findMany({
      where: { eventId: id },
      orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    }),
  ])

  return (
    <EquipeView
      event={{
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date ? event.date.toISOString() : null,
      }}
      owner={{ name: event.user.name, email: event.user.email }}
      targetVolunteers={event.targetVolunteers}
      races={event.races}
      initialMembers={members.map((m) => {
        let raceIds: string[] = []
        try {
          raceIds = JSON.parse(m.raceIds) as string[]
        } catch {
          raceIds = []
        }
        return {
          id: m.id,
          name: m.name,
          email: m.email,
          phone: m.phone,
          role: m.role,
          status: m.status,
          inviteToken: m.inviteToken,
          raceIds,
          sectionId: m.sectionId,
          note: m.note,
        }
      })}
      initialPartners={partners.map((p) => ({
        id: p.id,
        name: p.name,
        kind: p.kind,
        contactName: p.contactName,
        email: p.email,
        phone: p.phone,
        note: p.note,
      }))}
      initialSections={sections.map((s) => ({
        id: s.id,
        name: s.name,
        color: s.color,
        responsibleId: s.responsibleId,
      }))}
      canEdit={canManage(access)}
    />
  )
}
