import { notFound } from 'next/navigation'
import db from '@/lib/db'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'
import { applyTraceSnapshot, decodeSnapshot } from '@/lib/sim-snapshot'
import { ResultsView } from '@/app/events/[id]/results/[simId]/results-view'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ token: string }>
}

// Public, read-only view of a shared simulation result. No auth: anyone with the
// link can view, nobody can edit. Organisers use the normal /events route.
export default async function SharedResultsPage({ params }: PageProps) {
  const { token } = await params

  const simulation = await db.simulation.findUnique({
    where: { shareToken: token },
    include: { event: true, runnerProfiles: true },
  })
  if (!simulation || simulation.status !== 'DONE') notFound()

  const races = applyTraceSnapshot(
    await db.race.findMany({ where: { eventId: simulation.eventId }, include: { segments: true } }),
    simulation.gpxSnapshot
  )

  const result = decodeSnapshot<CompressedSimulationResult>(simulation.resultSnapshot)

  const parsedRaces = races.map((race) => {
    let gpxPoints: GPXPoint[] = []
    try {
      gpxPoints = JSON.parse(race.gpxPoints) as GPXPoint[]
    } catch {
      gpxPoints = []
    }
    return {
      id: race.id,
      name: race.name,
      color: race.color,
      distance: race.distance,
      elevGain: race.elevGain,
      startTime: race.startTime,
      gpxPoints,
      segments: race.segments.map((s) => ({
        type: s.type,
        lat: s.lat,
        lng: s.lng,
        indexStart: s.indexStart,
        label: s.label,
        ravitoSec: s.ravitoSec,
      })),
    }
  })

  return (
    <ResultsView
      readOnly
      event={{
        id: simulation.event.id,
        name: simulation.event.name,
        location: simulation.event.location,
        date: simulation.event.date,
      }}
      simulation={{
        id: simulation.id,
        name: simulation.name,
        totalRunners: simulation.totalRunners,
        temperature: simulation.temperature,
        wind: simulation.wind,
        rain: simulation.rain,
        fog: simulation.fog,
        logistique: simulation.logistique,
        nRuns: simulation.nRuns,
        racesSnapshot: simulation.racesSnapshot,
      }}
      result={result}
      races={parsedRaces}
      implantation={simulation.event.implantation ?? '[]'}
      members={[]}
      runnerProfiles={simulation.runnerProfiles.map((p) => ({
        id: p.id,
        label: p.label,
        color: p.color,
        percentage: p.percentage,
        abandonRate: p.abandonRate,
        baseSpeedMin: p.baseSpeedMin,
        baseSpeedMax: p.baseSpeedMax,
      }))}
    />
  )
}
