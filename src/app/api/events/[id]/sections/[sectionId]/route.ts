import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"

const SectionPatchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  color: z.string().max(20).optional(),
  responsibleId: z.string().nullable().optional(),
  order: z.number().int().optional(),
})

async function authorize(sessionUserId: string, eventId: string, sectionId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const section = await db.section.findUnique({ where: { id: sectionId } })
  if (!section || section.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Section not found" }
  }
  return { ok: true as const }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, sectionId } = await params
    const authz = await authorize(session.user.id, id, sectionId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const parsed = SectionPatchSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const updated = await db.section.update({ where: { id: sectionId }, data: parsed.data })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH section]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; sectionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, sectionId } = await params
    const authz = await authorize(session.user.id, id, sectionId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    // Detach volunteers from the deleted section (leaves them unassigned).
    await db.eventMember.updateMany({ where: { eventId: id, sectionId }, data: { sectionId: null } })
    await db.section.delete({ where: { id: sectionId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE section]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
