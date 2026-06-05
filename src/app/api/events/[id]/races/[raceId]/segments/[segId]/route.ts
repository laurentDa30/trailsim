import { auth } from "@/lib/auth"
import db from "@/lib/db"

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; raceId: string; segId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id, raceId, segId } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 })
    if (event.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 })

    const segment = await db.segment.findUnique({ where: { id: segId } })
    if (!segment || segment.raceId !== raceId) {
      return Response.json({ error: "Segment not found" }, { status: 404 })
    }

    await db.segment.delete({ where: { id: segId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE segment]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
