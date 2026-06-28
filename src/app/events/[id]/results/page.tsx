import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getEventAccess, canRead } from '@/lib/authz'
import db from '@/lib/db'
import { Topbar } from '@/components/layout/topbar'
import { Badge } from '@/components/ui/badge'
import {
  PlusIcon,
  CalendarClockIcon,
  GaugeIcon,
  ThermometerIcon,
  FlagIcon,
  UsersIcon,
  ChevronRightIcon,
  GitCompareIcon,
  FileTextIcon,
  MapIcon,
} from 'lucide-react'
import { DeleteSimButton } from './delete-sim-button'
import { RenameSimButton } from './rename-sim-button'
import { ShareSimButton } from './share-sim-button'

interface PageProps {
  params: Promise<{ id: string }>
}

type RaceSnap = { id: string; name: string; distance?: number; startTime: number; color?: string }

const STATUS_BADGE: Record<string, { variant: 'done' | 'running' | 'pending' | 'error'; label: string }> = {
  DONE: { variant: 'done', label: 'Terminée' },
  RUNNING: { variant: 'running', label: 'En cours' },
  PENDING: { variant: 'pending', label: 'En attente' },
  ERROR: { variant: 'error', label: 'Échec' },
}

function startLabel(min: number): string {
  if (!min) return 'départ commun (T0)'
  if (min % 60 === 0) return `T+${min / 60} h`
  return `T+${min} min`
}

function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export default async function SimulationsHistoryPage({ params }: PageProps) {
  const { id } = await params
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const event = await db.event.findUnique({
    where: { id },
    include: {
      simulations: {
        orderBy: { createdAt: 'desc' },
        include: { runnerProfiles: true },
      },
    },
  })

  if (!event || !canRead(await getEventAccess(session.user.id, event.id))) notFound()

  const sims = event.simulations

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Topbar
        activePage="results"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
      />

      <main className="flex-1 px-6 py-8 max-w-5xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
              Historique des simulations
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-ink-3)' }}>
              Chaque ligne fige la config utilisée (départs, vitesses, météo). Pour tester une
              nouvelle config, lancez une nouvelle simulation depuis la configuration.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {sims.filter((s) => s.status === 'DONE').length >= 2 && (
              <Link
                href={`/events/${event.id}/results/compare`}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
              >
                <GitCompareIcon size={15} />
                Comparer
              </Link>
            )}
            <Link
              href={`/events/${event.id}/setup`}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors"
              style={{ background: 'var(--color-lime)', color: '#fff' }}
            >
              <PlusIcon size={15} />
              Nouvelle simulation
            </Link>
          </div>
        </div>

        {sims.length === 0 ? (
          <div
            className="rounded-xl p-8 text-center text-sm"
            style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)', color: 'var(--color-ink-3)' }}
          >
            Aucune simulation pour le moment.{' '}
            <Link href={`/events/${event.id}/setup`} style={{ color: 'var(--color-lime)' }}>
              Configurez et lancez la première →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {sims.map((sim) => {
              const st = STATUS_BADGE[sim.status] ?? STATUS_BADGE.PENDING
              const isDone = sim.status === 'DONE'

              // Faithful départs from the snapshot (falls back gracefully for old runs)
              let races: RaceSnap[] = []
              if (sim.racesSnapshot) {
                try {
                  races = JSON.parse(sim.racesSnapshot) as RaceSnap[]
                } catch {
                  races = []
                }
              }
              const staggered = races.some((r) => r.startTime > 0)

              // Speed range across the run's profiles
              let speedLabel = '—'
              if (sim.runnerProfiles.length > 0) {
                const lo = Math.min(...sim.runnerProfiles.map((p) => p.baseSpeedMin))
                const hi = Math.max(...sim.runnerProfiles.map((p) => p.baseSpeedMax))
                speedLabel = `${lo}–${hi} km/h`
              }

              const weatherBits: string[] = [`${Math.round(sim.temperature)}°C`]
              if (sim.wind > 0) weatherBits.push(`vent ${Math.round(sim.wind)} km/h`)
              if (sim.rain) weatherBits.push('pluie')
              if (sim.fog) weatherBits.push('brouillard')

              const card = (
                <div
                  className="rounded-xl p-4 transition-colors"
                  style={{
                    border: '1px solid var(--color-line)',
                    background: 'var(--color-bg-1)',
                  }}
                >
                  {/* Top row */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-sm font-semibold truncate" style={{ color: 'var(--color-ink)' }}>
                        {sim.name}
                      </span>
                      <RenameSimButton simId={sim.id} simName={sim.name} />
                      <Badge variant={st.variant}>{st.label}</Badge>
                      {staggered && <Badge variant="warning">départs décalés</Badge>}
                    </div>
                    <span className="flex items-center gap-1.5 text-[11.5px] shrink-0" style={{ color: 'var(--color-ink-4)' }}>
                      <CalendarClockIcon size={12} />
                      {formatDateTime(sim.createdAt)}
                    </span>
                  </div>

                  {/* Config chips */}
                  <div className="flex items-center gap-x-4 gap-y-1.5 flex-wrap mt-3 text-[11.5px]" style={{ color: 'var(--color-ink-3)' }}>
                    <span className="flex items-center gap-1.5">
                      <UsersIcon size={12} style={{ color: 'var(--color-ink-4)' }} />
                      {sim.totalRunners} coureurs
                    </span>
                    <span className="flex items-center gap-1.5">
                      <GaugeIcon size={12} style={{ color: 'var(--color-ink-4)' }} />
                      {speedLabel}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <ThermometerIcon size={12} style={{ color: 'var(--color-ink-4)' }} />
                      {weatherBits.join(' · ')}
                    </span>
                    <span style={{ color: 'var(--color-ink-4)' }}>{sim.nRuns} runs</span>
                  </div>

                  {/* Départs per course (from snapshot) */}
                  {races.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      <FlagIcon size={12} style={{ color: 'var(--color-ink-4)' }} />
                      {races.map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
                          style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
                        >
                          <span className="w-2 h-2 rounded-full" style={{ background: r.color ?? 'var(--color-ink-4)' }} />
                          {r.name}
                          <span style={{ color: 'var(--color-ink-4)' }}>· {startLabel(r.startTime)}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-end gap-2 mt-3 flex-wrap">
                    <DeleteSimButton simId={sim.id} simName={sim.name} />
                    {isDone ? (
                      <>
                        <ShareSimButton simId={sim.id} initialToken={sim.shareToken} />
                        <Link
                          href={`/events/${event.id}/report/${sim.id}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
                        >
                          <FileTextIcon size={13} />
                          Rapport PDF
                        </Link>
                        <Link
                          href={`/events/${event.id}/terrain/${sim.id}`}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                          style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
                        >
                          <MapIcon size={13} />
                          Plan terrain
                        </Link>
                        <Link
                          href={`/events/${event.id}/results/${sim.id}`}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                          style={{ background: 'var(--color-lime)', color: '#fff' }}
                        >
                          Voir le résultat
                          <ChevronRightIcon size={14} />
                        </Link>
                      </>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
                        {sim.status === 'ERROR' ? 'Échec du calcul' : 'Calcul en cours…'}
                      </span>
                    )}
                  </div>
                </div>
              )

              return <div key={sim.id}>{card}</div>
            })}
          </div>
        )}
      </main>
    </div>
  )
}
