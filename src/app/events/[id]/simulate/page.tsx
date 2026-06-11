import { notFound, redirect } from 'next/navigation'
import db from '@/lib/db'
import { auth } from '@/lib/auth'
import { getEventAccess, canRead } from '@/lib/authz'
import { SimulateRunner } from './simulate-runner'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SimulatePage({ params }: PageProps) {
  const { id } = await params

  const event = await db.event.findUnique({
    where: { id },
    include: {
      races: {
        orderBy: { startTime: 'asc' },
        include: { segments: true },
      },
      simulations: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          runnerProfiles: true,
        },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const session = await auth()
  if (!session?.user?.id || !canRead(await getEventAccess(session.user.id, id))) notFound()

  const simulation = event.simulations[0] ?? null

  if (!simulation) {
    redirect(`/events/${id}/setup`)
  }

  const races = event.races.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    gpxPoints: r.gpxPoints,
    startTime: r.startTime,
    segments: r.segments.map((s) => ({
      type: s.type,
      indexStart: s.indexStart,
      width: s.width,
      techLevel: s.techLevel,
      lengthM: s.lengthM,
      ravitoSec: s.ravitoSec,
    })),
  }))

  const sim = {
    id: simulation.id,
    name: simulation.name,
    status: simulation.status,
    totalRunners: simulation.totalRunners,
    temperature: simulation.temperature,
    wind: simulation.wind,
    windDirection: simulation.windDirection,
    rain: simulation.rain,
    rainIntensity: simulation.rainIntensity,
    fog: simulation.fog,
    jamThreshold: simulation.jamThreshold,
    affluenceThreshold: simulation.affluenceThreshold,
    nRuns: simulation.nRuns,
    peloton: simulation.peloton,
    racesSnapshot: simulation.racesSnapshot,
    runnerProfiles: simulation.runnerProfiles,
  }

  return (
    <SimulateRunner
      event={{ id: event.id, name: event.name, location: event.location }}
      simulation={sim}
      races={races}
    />
  )
}
