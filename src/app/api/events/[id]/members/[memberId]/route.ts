import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"

const MemberPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(["ORGANISATEUR", "BENEVOLE"]).optional(),
  note: z.string().max(500).nullable().optional(),
  // Revoke the current access link and issue a new one (if the old link leaked).
  regenerateToken: z.boolean().optional(),
})

async function authorize(sessionUserId: string, eventId: string, memberId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const member = await db.eventMember.findUnique({ where: { id: memberId } })
  if (!member || member.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Member not found" }
  }
  return { ok: true as const, member }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, memberId } = await params
    const authz = await authorize(session.user.id, id, memberId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = MemberPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const { regenerateToken, ...rest } = parsed.data
    const updated = await db.eventMember.update({
      where: { id: memberId },
      data: {
        ...rest,
        ...(regenerateToken ? { inviteToken: crypto.randomUUID() } : {}),
      },
    })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH member]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, memberId } = await params
    const authz = await authorize(session.user.id, id, memberId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.eventMember.delete({ where: { id: memberId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE member]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
