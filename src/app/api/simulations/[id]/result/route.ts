import { gunzipSync } from "node:zlib"
import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const ResultSchema = z.object({
  resultSnapshot: z.record(z.string(), z.unknown()),
  riskMap: z.record(z.string(), z.unknown()).optional(),
})

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

    if (!canManage(await getEventAccess(session.user.id, simulation.eventId))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    // Large snapshots arrive gzip-compressed from the browser (the raw JSON of
    // a big peloton exceeds host request-body limits).
    let body: unknown
    if (request.headers.get("x-content-codec") === "gzip") {
      const buf = Buffer.from(await request.arrayBuffer())
      body = JSON.parse(gunzipSync(buf).toString("utf8"))
    } else {
      body = await request.json()
    }
    const parsed = ResultSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { resultSnapshot, riskMap } = parsed.data

    const updated = await db.simulation.update({
      where: { id },
      data: {
        status: "DONE",
        resultSnapshot: JSON.stringify(resultSnapshot),
        ...(riskMap !== undefined && { riskMap: JSON.stringify(riskMap) }),
      },
      // Don't echo the multi-MB snapshot back to the client.
      select: { id: true, status: true },
    })

    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH /api/simulations/[id]/result]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
