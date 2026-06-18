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
    select: { id: true, name: true, location: true, date: true },
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

  const members = await db.eventMember.findMany({
    where: { eventId: id },
    select: { name: true },
    orderBy: { name: 'asc' },
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
        taskId: i.taskId,
      }))}
      tasks={tasks}
      memberNames={members.map((m) => m.name)}
      canEdit={canManage(access)}
    />
  )
}
