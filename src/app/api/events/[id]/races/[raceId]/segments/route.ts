import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { z } from "zod"

const SegmentCreateSchema = z.object({
  type: z.string().min(1),
  indexStart: z.number().int().min(0),
  lat: z.number(),
  lng: z.number(),
  width: z.number().min(0).max(1).default(0.5),
  techLevel: z.number().int().min(0).max(5).default(1),
  label: z.string().optional(),
})

async function authorizeRace(sessionUserId: string, eventId: string, raceId: string) {
  const event = await db.event.findUnique({ where: { id: eventId } })
  if (!event) return { ok: false as const, status: 404, error: "Event not found" }
  if (event.userId !== sessionUserId) return { ok: false as const, status: 403, error: "Forbidden" }
  const race = await db.race.findUnique({ where: { id: raceId } })
  if (!race || race.eventId !== eventId) return { ok: false as const, status: 404, error: "Race not found" }
  return { ok: true as const }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; raceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, raceId } = await params
    const authz = await authorizeRace(session.user.id, id, raceId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })
    const segments = await db.segment.findMany({ where: { raceId } })
    return Response.json(segments)
  } catch (error) {
    console.error("[GET segments]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
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
    const parsed = SegmentCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const segment = await db.segment.create({
      data: {
        raceId,
        type: parsed.data.type,
        indexStart: parsed.data.indexStart,
        indexEnd: parsed.data.indexStart,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        width: parsed.data.width,
        techLevel: parsed.data.techLevel,
        label: parsed.data.label,
      },
    })
    return Response.json(segment, { status: 201 })
  } catch (error) {
    console.error("[POST segments]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
