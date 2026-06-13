import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import type { PlacedLogi } from "@/lib/logistics"

// Persist the event-level field staffing plan (postes). Durable across
// simulations: edited from any simulation's results map, stored on the event.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = (await request.json()) as { implantation?: unknown }
    const raw = Array.isArray(body.implantation) ? (body.implantation as PlacedLogi[]) : null
    if (!raw) {
      return Response.json({ error: "Validation error" }, { status: 400 })
    }

    // Keep only well-formed entries (defensive: client-built objects).
    const clean = raw
      .filter(
        (l) =>
          l &&
          typeof l.id === "string" &&
          typeof l.type === "string" &&
          typeof l.lat === "number" &&
          typeof l.lng === "number"
      )
      .map((l) => ({
        id: l.id,
        type: l.type,
        lat: l.lat,
        lng: l.lng,
        ...(l.label != null ? { label: String(l.label) } : {}),
        ...(l.memberId != null ? { memberId: String(l.memberId) } : {}),
      }))

    await db.event.update({
      where: { id },
      data: { implantation: JSON.stringify(clean) },
    })

    return Response.json({ ok: true, count: clean.length })
  } catch (error) {
    console.error("[PATCH /api/events/[id]/implantation]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
