import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { z } from "zod"

const RaceCreateSchema = z.object({
  name: z.string().min(1, "Name is required"),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color").default("#7CB518"),
  startTime: z.number().int().min(0).default(0),
  distance: z.number().min(0).default(0),
  elevGain: z.number().int().min(0).default(0),
  elevLoss: z.number().int().min(0).default(0),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 })
    }
    if (event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const races = await db.race.findMany({
      where: { eventId: id },
      include: { segments: true },
      orderBy: { startTime: "asc" },
    })

    return Response.json(races)
  } catch (error) {
    console.error("[GET /api/events/[id]/races]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 })
    }
    if (event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = RaceCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, color, startTime, distance, elevGain, elevLoss } = parsed.data

    const race = await db.race.create({
      data: {
        name,
        color,
        startTime,
        distance,
        elevGain,
        elevLoss,
        eventId: id,
      },
    })

    return Response.json(race, { status: 201 })
  } catch (error) {
    console.error("[POST /api/events/[id]/races]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
