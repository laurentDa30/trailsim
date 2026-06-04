import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { z } from "zod"

const SimulationUpdateSchema = z.object({
  status: z.string().optional(),
  resultSnapshot: z.record(z.string(), z.unknown()).optional(),
  riskMap: z.record(z.string(), z.unknown()).optional(),
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

    const simulation = await db.simulation.findUnique({
      where: { id },
      include: {
        runnerProfiles: true,
        event: true,
      },
    })

    if (!simulation) {
      return Response.json({ error: "Simulation not found" }, { status: 404 })
    }

    if (simulation.event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    return Response.json(simulation)
  } catch (error) {
    console.error("[GET /api/simulations/[id]]", error)
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

    const simulation = await db.simulation.findUnique({
      where: { id },
      include: { event: { select: { userId: true } } },
    })

    if (!simulation) {
      return Response.json({ error: "Simulation not found" }, { status: 404 })
    }

    if (simulation.event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const parsed = SimulationUpdateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { status, resultSnapshot, riskMap } = parsed.data

    const updated = await db.simulation.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(resultSnapshot !== undefined && { resultSnapshot: JSON.stringify(resultSnapshot) }),
        ...(riskMap !== undefined && { riskMap: JSON.stringify(riskMap) }),
      },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH /api/simulations/[id]]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
