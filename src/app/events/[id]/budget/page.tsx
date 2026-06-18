import { notFound } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canManage, canRead } from '@/lib/authz'
import { BudgetView } from './budget-view'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function BudgetPage({ params }: PageProps) {
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

  const items = await db.budgetItem.findMany({
    where: { eventId: id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  const tasks = await db.task.findMany({
    where: { eventId: id },
    select: { id: true, title: true },
    orderBy: { createdAt: 'asc' },
  })

  const memberRows = await db.eventMember.findMany({
    where: { eventId: id },
    select: { id: true, name: true, userId: true },
    orderBy: { name: 'asc' },
  })
  // Include the event owner (organiser) so "Qui" can target them too.
  const ownerIsMember = memberRows.some((m) => m.userId === event.user.id)
  const members = [
    ...(ownerIsMember ? [] : [{ id: event.user.id, name: event.user.name || event.user.email }]),
    ...memberRows.map((m) => ({ id: m.id, name: m.name })),
  ]

  // Runner count from the latest simulation — used for the "cost per runner".
  const latestSim = await db.simulation.findFirst({
    where: { eventId: id },
    orderBy: { createdAt: 'desc' },
    select: { totalRunners: true },
  })

  return (
    <BudgetView
      event={{
        id: event.id,
        name: event.name,
        location: event.location,
        date: event.date ? event.date.toISOString() : null,
      }}
      initialItems={items.map((i) => ({
        id: i.id,
        type: i.type as 'DEPENSE' | 'GAIN',
        category: i.category,
        label: i.label,
        quantity: i.quantity,
        supplier: i.supplier,
        estimated: i.estimated,
        paid: i.paid,
        who: i.who,
        documentUrl: i.documentUrl,
        taskId: i.taskId,
      }))}
      tasks={tasks}
      members={members}
      runnerCount={latestSim?.totalRunners ?? 0}
      canEdit={canManage(access)}
    />
  )
}
