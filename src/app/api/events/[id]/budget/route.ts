import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const ItemCreateSchema = z.object({
  type: z.enum(["DEPENSE", "GAIN"]).default("DEPENSE"),
  category: z.string().max(120).optional(),
  label: z.string().min(1).max(200),
  quantity: z.number().int().nonnegative().nullable().optional(),
  unitPrice: z.number().nonnegative().nullable().optional(),
  supplier: z.string().max(200).nullable().optional(),
  estimated: z.number().nonnegative().optional(),
  paid: z.number().nonnegative().optional(),
  who: z.string().max(120).nullable().optional(),
  documentUrl: z.string().max(2000).nullable().optional(),
  taskId: z.string().nullable().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!canRead(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const items = await db.budgetItem.findMany({
      where: { eventId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
    return Response.json(items)
  } catch (error) {
    console.error("[GET budget]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const body = await request.json()
    const parsed = ItemCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const d = parsed.data
    const item = await db.budgetItem.create({
      data: {
        eventId: id,
        type: d.type,
        category: d.category ?? "",
        label: d.label,
        quantity: d.quantity ?? null,
        unitPrice: d.unitPrice ?? null,
        supplier: d.supplier ?? null,
        estimated: d.estimated ?? 0,
        paid: d.paid ?? 0,
        who: d.who ?? null,
        documentUrl: d.documentUrl ?? null,
        taskId: d.taskId ?? null,
      },
    })
    return Response.json(item, { status: 201 })
  } catch (error) {
    console.error("[POST budget]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
