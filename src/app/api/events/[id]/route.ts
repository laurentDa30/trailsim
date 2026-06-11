import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { EventCreateSchema } from "@/lib/validators/simulation"
import { z } from "zod"

// Partial event update (currently just the T0 wall-clock set on the courses step).
const EventPatchSchema = z.object({
  startClock: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Format attendu HH:MM")
    .nullable()
    .optional(),
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

    const event = await db.event.findUnique({
      where: { id },
      include: {
        races: {
          include: { segments: true },
          orderBy: { startTime: "asc" },
        },
        simulations: {
          orderBy: { createdAt: "desc" },
        },
      },
    })

    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 })
    }

    if (!canRead(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    return Response.json(event)
  } catch (error) {
    console.error("[GET /api/events/[id]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function PUT(
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
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = EventCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, description, date, location } = parsed.data

    const updated = await db.event.update({
      where: { id },
      data: {
        name,
        description,
        date: date ? new Date(date) : null,
        location,
      },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("[PUT /api/events/[id]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

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

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 })
    }
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = EventPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const updated = await db.event.update({ where: { id }, data: parsed.data })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH /api/events/[id]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
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
    // Deleting the event stays owner-only — a co-organiser can't destroy it.
    if (event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    await db.event.delete({ where: { id } })

    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE /api/events/[id]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
