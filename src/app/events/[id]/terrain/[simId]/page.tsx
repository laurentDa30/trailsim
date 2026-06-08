import { notFound } from 'next/navigation'
import db from '@/lib/db'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'
import { clusterRiskZones, type RaceLite } from '@/lib/report-metrics'
import type { OpMapRace, OpMapZone } from '../../report/[simId]/operational-map'
import { TerrainView } from './terrain-view'

interface PageProps {
  params: Promise<{ id: string; simId: string }>
}

function downsample<T>(arr: T[], maxPts = 600): T[] {
  if (arr.length <= maxPts) return arr
  const step = Math.ceil(arr.length / maxPts)
  const out: T[] = []
  for (let i = 0; i < arr.length; i += step) out.push(arr[i])
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1])
  return out
}

export default async function TerrainPage({ params }: PageProps) {
  const { id, simId } = await params

  const sim = await db.simulation.findUnique({ where: { id: simId }, include: { event: true } })
  if (!sim) notFound()

  const races = await db.race.findMany({ where: { eventId: id }, include: { segments: true } })

  let result: CompressedSimulationResult | null = null
  if (sim.resultSnapshot) {
    try {
      result = JSON.parse(sim.resultSnapshot) as CompressedSimulationResult
    } catch {
      result = null
    }
  }

  const parsedRaces = races.map((race) => {
    let gpxPoints: GPXPoint[] = []
    try {
      gpxPoints = JSON.parse(race.gpxPoints) as GPXPoint[]
    } catch {
      gpxPoints = []
    }
    return { ...race, gpxPoints }
  })

  const racesLite: RaceLite[] = parsedRaces.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    gpxPoints: r.gpxPoints,
  }))
  const clustered = result ? clusterRiskZones(result.riskMap, racesLite) : []

  const mapRaces: OpMapRace[] = parsedRaces.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    points: downsample(r.gpxPoints).map((p) => ({ lat: p.lat, lng: p.lng, dist: p.dist })),
    segments: r.segments.map((s) => ({
      type: s.type,
      label: s.label,
      lat: s.lat,
      lng: s.lng,
      dist: r.gpxPoints[s.indexStart]?.dist ?? 0,
    })),
  }))
  const mapZones: OpMapZone[] = clustered
    .map((z) => {
      const race = parsedRaces.find((r) => r.id === z.raceId)
      const pt = race?.gpxPoints[z.segmentIndex]
      if (!pt) return null
      return { raceId: z.raceId, lat: pt.lat, lng: pt.lng, dist: z.dist, kind: z.kind }
    })
    .filter((z): z is OpMapZone => z != null)

  return (
    <TerrainView
      eventId={id}
      simId={simId}
      eventName={sim.event.name}
      simName={sim.name}
      races={mapRaces}
      zones={mapZones}
    />
  )
}
