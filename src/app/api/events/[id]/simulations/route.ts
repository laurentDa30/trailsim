import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { SimulationCreateSchema } from "@/lib/validators/simulation"

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

    const simulations = await db.simulation.findMany({
      where: { eventId: id },
      include: { runnerProfiles: true },
      orderBy: { createdAt: "desc" },
    })

    return Response.json(simulations)
  } catch (error) {
    console.error("[GET /api/events/[id]/simulations]", error)
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
    const parsed = SimulationCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, totalRunners, temperature, wind, windDirection, rain, rainIntensity, fog, runnerProfiles } = parsed.data

    const simulation = await db.simulation.create({
      data: {
        name,
        eventId: id,
        totalRunners,
        temperature,
        wind,
        windDirection,
        rain,
        rainIntensity,
        fog,
        status: "PENDING",
        runnerProfiles: {
          create: runnerProfiles.map((profile) => ({
            label: profile.label,
            percentage: profile.percentage,
            baseSpeedMin: profile.baseSpeedMin,
            baseSpeedMax: profile.baseSpeedMax,
            climbCoeff: profile.climbCoeff,
            descentCoeff: profile.descentCoeff,
            fatigueFactor: profile.fatigueFactor,
            techSkill: profile.techSkill,
            ravitoDuration: profile.ravitoDuration,
            abandonRate: profile.abandonRate,
            color: profile.color,
          })),
        },
      },
      include: { runnerProfiles: true },
    })

    return Response.json(simulation, { status: 201 })
  } catch (error) {
    console.error("[POST /api/events/[id]/simulations]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
