import { auth } from "@/lib/auth"
import db from "@/lib/db"
import type { GPXPoint } from "@/engine/types"

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function bearing(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const y = Math.sin(dLon) * Math.cos((lat2 * Math.PI) / 180)
  const x =
    Math.cos((lat1 * Math.PI) / 180) * Math.sin((lat2 * Math.PI) / 180) -
    Math.sin((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.cos(dLon)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

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
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 })
    if (event.userId !== session.user.id) return Response.json({ error: "Forbidden" }, { status: 403 })

    const race = await db.race.findUnique({ where: { id: raceId } })
    if (!race || race.eventId !== id) return Response.json({ error: "Race not found" }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    if (!file) return Response.json({ error: "No file provided" }, { status: 400 })

    const gpxText = await file.text()

    // Parse <trkpt lat="..." lon="..."> with optional <ele>
    const trkptRegex = /<trkpt\b[^>]*\blat="([^"]+)"[^>]*\blon="([^"]+)"[^>]*>([\s\S]*?)<\/trkpt>/g
    const rawPts: { lat: number; lng: number; alt: number }[] = []
    let m: RegExpExecArray | null
    while ((m = trkptRegex.exec(gpxText)) !== null) {
      const eleMatch = m[3].match(/<ele>([\d.]+)<\/ele>/)
      rawPts.push({
        lat: parseFloat(m[1]),
        lng: parseFloat(m[2]),
        alt: eleMatch ? parseFloat(eleMatch[1]) : 0,
      })
    }

    if (rawPts.length < 2) {
      return Response.json({ error: "GPX file contains no track points" }, { status: 400 })
    }

    // Build GPXPoint array with cumulative distance, slope, aspect
    const points: GPXPoint[] = []
    let cumDist = 0
    let elevGain = 0
    let elevLoss = 0

    for (let i = 0; i < rawPts.length; i++) {
      const p = rawPts[i]
      if (i > 0) {
        const prev = rawPts[i - 1]
        const segKm = haversineKm(prev.lat, prev.lng, p.lat, p.lng)
        cumDist += segKm
        const dAlt = p.alt - prev.alt
        if (dAlt > 0) elevGain += dAlt
        else elevLoss += Math.abs(dAlt)
      }

      const next = rawPts[Math.min(i + 1, rawPts.length - 1)]
      const prev = rawPts[Math.max(i - 1, 0)]
      const segH = haversineKm(prev.lat, prev.lng, next.lat, next.lng) * 1000
      const slope = segH > 0 ? ((next.alt - prev.alt) / segH) * 100 : 0

      points.push({
        lat: p.lat,
        lng: p.lng,
        alt: p.alt,
        dist: cumDist,
        slope: Math.max(-60, Math.min(60, slope)),
        aspect: bearing(prev.lat, prev.lng, next.lat, next.lng),
      })
    }

    const updated = await db.race.update({
      where: { id: raceId },
      data: {
        gpxRaw: gpxText,
        gpxPoints: JSON.stringify(points),
        distance: Math.round(cumDist * 10) / 10,
        elevGain: Math.round(elevGain),
        elevLoss: Math.round(elevLoss),
      },
    })

    return Response.json({
      distance: updated.distance,
      elevGain: updated.elevGain,
      elevLoss: updated.elevLoss,
      pointCount: points.length,
    })
  } catch (error) {
    console.error("[POST /api/events/[id]/races/[raceId]/gpx]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
