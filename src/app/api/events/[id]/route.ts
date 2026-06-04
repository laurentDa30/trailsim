import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { EventCreateSchema } from "@/lib/validators/simulation"

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

    if (event.userId !== session.user.id) {
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
    if (event.userId !== session.user.id) {
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
