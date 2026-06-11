import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
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
    if (!canRead(await getEventAccess(session.user.id, id))) {
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
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = SimulationCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, totalRunners, temperature, wind, windDirection, rain, rainIntensity, fog, jamThreshold, affluenceThreshold, nRuns, ressources, logistique, peloton, runnerProfiles } = parsed.data

    // Snapshot the courses as they are right now: départs (for the history) and
    // traces + segments (results pages must render the geometry THIS run used,
    // even if a GPX is re-uploaded later — positions are fractions of the trace).
    const racesNow = await db.race.findMany({
      where: { eventId: id },
      orderBy: { startTime: "asc" },
      include: { segments: true },
    })
    const racesSnapshot = JSON.stringify(
      racesNow.map((r) => ({
        id: r.id,
        name: r.name,
        distance: r.distance,
        startTime: r.startTime,
        color: r.color,
      }))
    )
    const gpxSnapshot = JSON.stringify(
      racesNow.map((r) => ({ id: r.id, gpxPoints: r.gpxPoints, segments: r.segments }))
    )

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
        jamThreshold,
        affluenceThreshold,
        nRuns,
        racesSnapshot,
        gpxSnapshot,
        ...(ressources !== undefined && { ressources }),
        ...(logistique !== undefined && { logistique }),
        ...(peloton !== undefined && { peloton }),
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
