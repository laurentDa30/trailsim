import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { PARTNER_KIND_VALUES, PARTNER_STATUS_VALUES, PARTNER_CONTRIBUTION_VALUES } from "@/lib/partners"
import { z } from "zod"

const PartnerPatchSchema = z.object({
  name: z.string().min(1).max(160).optional(),
  kind: z.enum(PARTNER_KIND_VALUES).optional(),
  status: z.enum(PARTNER_STATUS_VALUES).optional(),
  contactName: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  contributions: z.array(z.enum(PARTNER_CONTRIBUTION_VALUES)).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  nextContactDate: z.string().datetime().nullable().optional(),
  wish: z.string().max(500).nullable().optional(),
  budgetGainId: z.string().nullable().optional(),
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

export async function PATCH(
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
    const parsed = PartnerPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const { contributions, nextContactDate, ...rest } = parsed.data
    const updated = await db.partner.update({
      where: { id: partnerId },
      data: {
        ...rest,
        ...(contributions !== undefined ? { contributions: JSON.stringify(contributions) } : {}),
        ...(nextContactDate !== undefined
          ? { nextContactDate: nextContactDate ? new Date(nextContactDate) : null }
          : {}),
      },
    })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH partner]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; partnerId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, partnerId } = await params
    const authz = await authorize(session.user.id, id, partnerId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.partner.delete({ where: { id: partnerId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE partner]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
