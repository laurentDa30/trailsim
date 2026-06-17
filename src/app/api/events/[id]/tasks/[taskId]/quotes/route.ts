import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"
import { QUOTE_STATUS_VALUES } from "@/lib/tasks"

const QuoteCreateSchema = z.object({
  label: z.string().min(1).max(200),
  amount: z.number().nonnegative().nullable().optional(),
  status: z.enum(QUOTE_STATUS_VALUES).default("A_CONTACTER"),
  note: z.string().max(1000).nullable().optional(),
})

async function authorize(sessionUserId: string, eventId: string, taskId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task || task.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Task not found" }
  }
  return { ok: true as const }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId } = await params
    const authz = await authorize(session.user.id, id, taskId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = QuoteCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const quote = await db.taskQuote.create({
      data: {
        taskId,
        label: parsed.data.label,
        amount: parsed.data.amount ?? null,
        status: parsed.data.status,
        note: parsed.data.note ?? null,
      },
    })
    return Response.json(quote, { status: 201 })
  } catch (error) {
    console.error("[POST task quote]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
