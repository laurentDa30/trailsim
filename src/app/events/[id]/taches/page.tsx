import { notFound } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canManage, canRead } from '@/lib/authz'
import { TachesView } from './taches-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function TachesPage({ params }: PageProps) {
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

  const tasks = await db.task.findMany({
    where: { eventId: id },
    orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
    include: { quotes: { orderBy: { createdAt: 'asc' } } },
  })

  // People a task can be assigned to: the event owner (organiser, not stored as
  // an EventMember) + the bureau members.
  const members = await db.eventMember.findMany({
    where: { eventId: id },
    select: { id: true, name: true, role: true, userId: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })
  const ownerIsMember = members.some((m) => m.userId === event.user.id)
  const assignees = [
    ...(ownerIsMember
      ? []
      : [{ id: event.user.id, name: event.user.name || event.user.email, role: 'ORGANISATEUR' }]),
    ...members.map((m) => ({ id: m.id, name: m.name, role: m.role })),
  ]

  return (
    <TachesView
      event={{
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date ? event.date.toISOString() : null,
      }}
      initialTasks={tasks.map((t) => ({
        id: t.id,
        title: t.title,
        category: t.category,
        status: t.status,
        startDate: t.startDate ? t.startDate.toISOString() : null,
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        done: t.done,
        parentId: t.parentId,
        note: t.note,
        assigneeId: t.assigneeId,
        amountEstimated: t.amountEstimated,
        amountActual: t.amountActual,
        quotes: t.quotes.map((q) => ({
          id: q.id,
          label: q.label,
          amount: q.amount,
          status: q.status,
          note: q.note,
        })),
      }))}
      members={assignees}
      canEdit={canManage(access)}
    />
  )
}
