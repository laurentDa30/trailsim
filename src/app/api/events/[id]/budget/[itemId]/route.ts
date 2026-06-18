import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"

const ItemPatchSchema = z.object({
  category: z.string().max(120).optional(),
  label: z.string().min(1).max(200).optional(),
  quantity: z.number().int().nonnegative().nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  estimated: z.number().nonnegative().optional(),
  paid: z.number().nonnegative().optional(),
  who: z.string().max(120).nullable().optional(),
  taskId: z.string().nullable().optional(),
})

async function authorize(sessionUserId: string, eventId: string, itemId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const item = await db.budgetItem.findUnique({ where: { id: itemId } })
  if (!item || item.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Item not found" }
  }
  return { ok: true as const }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, itemId } = await params
    const authz = await authorize(session.user.id, id, itemId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = ItemPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const updated = await db.budgetItem.update({ where: { id: itemId }, data: parsed.data })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH budget item]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, itemId } = await params
    const authz = await authorize(session.user.id, id, itemId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.budgetItem.delete({ where: { id: itemId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE budget item]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
