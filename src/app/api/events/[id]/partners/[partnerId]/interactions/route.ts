import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"

const InteractionCreateSchema = z.object({
  note: z.string().min(1).max(1000),
  by: z.string().max(120).nullable().optional(),
  date: z.string().datetime().nullable().optional(),
})

async function authorize(sessionUserId: string, eventId: string, partnerId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const partner = await db.partner.findUnique({ where: { id: partnerId } })
  if (!partner || partner.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Partner not found" }
  }
  return { ok: true as const }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; partnerId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, partnerId } = await params
    const authz = await authorize(session.user.id, id, partnerId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = InteractionCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const interaction = await db.partnerInteraction.create({
      data: {
        partnerId,
        note: parsed.data.note,
        by: parsed.data.by ?? null,
        ...(parsed.data.date ? { date: new Date(parsed.data.date) } : {}),
      },
    })
    return Response.json(interaction, { status: 201 })
  } catch (error) {
    console.error("[POST partner interaction]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
