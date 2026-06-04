import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { EventCreateSchema } from "@/lib/validators/simulation"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const events = await db.event.findMany({
      where: { userId: session.user.id },
      include: {
        _count: { select: { races: true, simulations: true } },
        simulations: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { id: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(events)
  } catch (error) {
    console.error("[GET /api/events]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const parsed = EventCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, description, date, location } = parsed.data

    const event = await db.event.create({
      data: {
        name,
        description,
        date: date ? new Date(date) : undefined,
        location,
        userId: session.user.id,
      },
    })

    return Response.json(event, { status: 201 })
  } catch (error) {
    console.error("[POST /api/events]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
