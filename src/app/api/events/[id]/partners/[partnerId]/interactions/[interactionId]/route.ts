import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; partnerId: string; interactionId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, partnerId, interactionId } = await params
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const interaction = await db.partnerInteraction.findUnique({
      where: { id: interactionId },
      include: { partner: { select: { eventId: true } } },
    })
    if (!interaction || interaction.partnerId !== partnerId || interaction.partner.eventId !== id) {
      return Response.json({ error: "Not found" }, { status: 404 })
    }
    await db.partnerInteraction.delete({ where: { id: interactionId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE partner interaction]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
