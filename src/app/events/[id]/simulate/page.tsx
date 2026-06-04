import { notFound, redirect } from 'next/navigation'
import db from '@/lib/db'
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
  }))

  const sim = {
    id: simulation.id,
    name: simulation.name,
    totalRunners: simulation.totalRunners,
    temperature: simulation.temperature,
    wind: simulation.wind,
    windDirection: simulation.windDirection,
    rain: simulation.rain,
    rainIntensity: simulation.rainIntensity,
    fog: simulation.fog,
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
