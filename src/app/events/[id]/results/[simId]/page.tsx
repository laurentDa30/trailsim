import { notFound, redirect } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canRead } from '@/lib/authz'
import { CompressedSimulationResult } from '@/engine/types'
import type { GPXPoint } from '@/engine/types'
import { ResultsView } from './results-view'

interface PageProps {
  params: Promise<{ id: string; simId: string }>
}

export default async function ResultsPage({ params }: PageProps) {
  const { id, simId } = await params

  const simulation = await db.simulation.findUnique({
    where: { id: simId },
    include: {
      event: true,
      runnerProfiles: true,
    },
  })

  if (!simulation) {
    notFound()
  }

  const session = await auth()
  if (!session?.user?.id || !canRead(await getEventAccess(session.user.id, simulation.eventId))) notFound()

  if (simulation.status !== 'DONE') {
    redirect(`/events/${id}/simulate`)
  }

  const races = await db.race.findMany({ where: { eventId: id }, include: { segments: true } })

  // Parse resultSnapshot
  let result: CompressedSimulationResult | null = null
  if (simulation.resultSnapshot) {
    try {
      result = JSON.parse(simulation.resultSnapshot) as CompressedSimulationResult
    } catch {
      result = null
    }
  }

  // Parse each race's gpxPoints
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
