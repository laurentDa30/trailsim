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
    select: { id: true, name: true, location: true, date: true },
  })
  if (!event) notFound()

  const tasks = await db.task.findMany({
    where: { eventId: id },
    orderBy: [{ done: 'asc' }, { dueDate: 'asc' }, { createdAt: 'asc' }],
  })

  // Bureau members the tasks can be assigned to (organisers first).
  const members = await db.eventMember.findMany({
    where: { eventId: id },
    select: { id: true, name: true, role: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  })

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
        dueDate: t.dueDate ? t.dueDate.toISOString() : null,
        done: t.done,
        parentId: t.parentId,
        note: t.note,
        assigneeId: t.assigneeId,
        amountEstimated: t.amountEstimated,
        amountActual: t.amountActual,
      }))}
      members={members}
      canEdit={canManage(access)}
    />
  )
}
