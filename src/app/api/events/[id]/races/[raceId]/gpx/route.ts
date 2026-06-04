import { auth } from "@/lib/auth"
import db from "@/lib/db"

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; raceId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id, raceId } = await params

    const event = await db.event.findUnique({ where: { id } })
    if (!event) {
      return Response.json({ error: "Event not found" }, { status: 404 })
    }
    if (event.userId !== session.user.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const race = await db.race.findUnique({ where: { id: raceId } })
    if (!race || race.eventId !== id) {
      return Response.json({ error: "Race not found" }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 })
    }

    const gpxText = await file.text()

    // Parse GPX XML to extract track stats
    const distMatch = gpxText.match(/<name>[\s\S]*?<\/name>/)
    const elevationPoints: number[] = []
    const eleMatches = gpxText.matchAll(/<ele>([\d.]+)<\/ele>/g)
    for (const m of eleMatches) {
      elevationPoints.push(parseFloat(m[1]))
    }

    let elevGain = 0
    let elevLoss = 0
    for (let i = 1; i < elevationPoints.length; i++) {
      const diff = elevationPoints[i] - elevationPoints[i - 1]
      if (diff > 0) elevGain += diff
      else elevLoss += Math.abs(diff)
    }

    // Count track points as proxy for distance
    const trkptCount = (gpxText.match(/<trkpt/g) || []).length
    const estimatedDistanceKm = Math.round(trkptCount * 0.05 * 10) / 10

    const updated = await db.race.update({
      where: { id: raceId },
      data: {
        gpxRaw: gpxText,
        elevGain: Math.round(elevGain),
        elevLoss: Math.round(elevLoss),
        distance: estimatedDistanceKm || race.distance,
      },
    })

    return Response.json({
      distance: updated.distance,
      elevGain: updated.elevGain,
      elevLoss: updated.elevLoss,
      pointCount: trkptCount,
    })
  } catch (error) {
    console.error("[POST /api/events/[id]/races/[raceId]/gpx]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
