import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { z } from "zod"

const RaceUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  startTime: z.number().int().min(0).optional(),
})

async function authorizeRace(
  sessionUserId: string,
  eventId: string,
  raceId: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return { ok: false, status: 404, error: "Event not found" }
  if (event.userId !== sessionUserId) return { ok: false, status: 403, error: "Forbidden" }
  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race || race.eventId !== eventId) return { ok: false, status: 404, error: "Race not found" }
  return { ok: true }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; raceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id, raceId } = await params
    const authz = await authorizeRace(session.user.id, id, raceId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = RaceUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const updated = await db.race.update({ where: { id: raceId }, data: parsed.data })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH /api/events/[id]/races/[raceId]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; raceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })

    const { id, raceId } = await params
    const authz = await authorizeRace(session.user.id, id, raceId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.race.delete({ where: { id: raceId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE /api/events/[id]/races/[raceId]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
