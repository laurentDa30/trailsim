import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"
import { QUOTE_STATUS_VALUES } from "@/lib/tasks"

const QuotePatchSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  status: z.enum(QUOTE_STATUS_VALUES).optional(),
  note: z.string().max(1000).nullable().optional(),
})

async function authorize(
  sessionUserId: string,
  eventId: string,
  taskId: string,
  quoteId: string
) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const quote = await db.taskQuote.findUnique({
    where: { id: quoteId },
    include: { task: { select: { id: true, eventId: true } } },
  })
  if (!quote || quote.taskId !== taskId || quote.task.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Quote not found" }
  }
  return { ok: true as const }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; quoteId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId, quoteId } = await params
    const authz = await authorize(session.user.id, id, taskId, quoteId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = QuotePatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const { amount, ...rest } = parsed.data
    const updated = await db.taskQuote.update({
      where: { id: quoteId },
      data: {
        ...rest,
        ...(amount !== undefined ? { amount } : {}),
      },
    })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH task quote]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string; quoteId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId, quoteId } = await params
    const authz = await authorize(session.user.id, id, taskId, quoteId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.taskQuote.delete({ where: { id: quoteId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE task quote]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
