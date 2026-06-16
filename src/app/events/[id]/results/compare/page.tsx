import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import { getEventAccess, canRead } from '@/lib/authz'
import db from '@/lib/db'
import { Topbar } from '@/components/layout/topbar'
import { ArrowLeftIcon } from 'lucide-react'
import type { CompressedSimulationResult } from '@/engine/types'
import { decodeSnapshot } from '@/lib/sim-snapshot'
import { ComparePicker } from './compare-picker'

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ a?: string; b?: string }>
}

type RaceSnap = { id: string; name: string; startTime: number; color?: string }

interface SimRow {
  id: string
  name: string
  createdAt: Date
  status: string
  totalRunners: number
  temperature: number
  wind: number
  rain: boolean
  fog: boolean
  nRuns: number
  racesSnapshot: string | null
  resultSnapshot: string | null
  runnerProfiles: { baseSpeedMin: number; baseSpeedMax: number }[]
}

function fmtDur(sec: number | null): string {
  if (sec == null || !isFinite(sec)) return '—'
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`
}

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(d)
}

interface Metrics {
  firstFinish: number | null
  dnf: number
  zones: number
  rencontres: number
  perRace: { id: string; name: string; color?: string; duration: number | null }[]
}

function computeMetrics(sim: SimRow): Metrics {
  let races: RaceSnap[] = []
  try {
    if (sim.racesSnapshot) races = JSON.parse(sim.racesSnapshot) as RaceSnap[]
  } catch {
    races = []
  }
  const empty: Metrics = { firstFinish: null, dnf: 0, zones: 0, rencontres: 0, perRace: [] }
  if (!sim.resultSnapshot) return { ...empty, perRace: races.map((r) => ({ id: r.id, name: r.name, color: r.color, duration: null })) }

  const res = decodeSnapshot<CompressedSimulationResult>(sim.resultSnapshot)
  if (!res) return empty
  const ts = res.globalTimestamps ?? []
  const byRace = new Map<string, { finish: number; depart: number }>()
  let dnf = 0
  for (const run of res.runnersData ?? []) {
    const e = byRace.get(run.raceId) ?? { finish: Infinity, depart: Infinity }
    let maxPos = 0
    let moved = false
    for (let t = 0; t < run.positions.length; t++) {
      const p = run.positions[t]
      if (p > maxPos) maxPos = p
      if (!moved && p > 0) {
        moved = true
        if (ts[t] != null && ts[t] < e.depart) e.depart = ts[t]
      }
      if (p >= 1) {
        if (ts[t] != null && ts[t] < e.finish) e.finish = ts[t]
        break
      }
    }
    if (maxPos < 0.999) dnf++
    byRace.set(run.raceId, e)
  }
  let firstFinish = Infinity
  for (const e of byRace.values()) if (e.finish < firstFinish) firstFinish = e.finish

  const perRace = (races.length > 0 ? races : [...byRace.keys()].map((id) => ({ id, name: id, startTime: 0 }))).map((r) => {
    const e = byRace.get(r.id)
    const duration = e && isFinite(e.finish) ? e.finish - (isFinite(e.depart) ? e.depart : 0) : null
    return { id: r.id, name: r.name, color: (r as RaceSnap).color, duration }
  })

  return {
    firstFinish: isFinite(firstFinish) ? firstFinish : null,
    dnf,
    zones: (res.riskMap ?? []).length,
    rencontres: (res.collisionWindows ?? []).length,
    perRace,
  }
}

function speedLabel(profiles: { baseSpeedMin: number; baseSpeedMax: number }[]): string {
  if (profiles.length === 0) return '—'
  const lo = Math.min(...profiles.map((p) => p.baseSpeedMin))
  const hi = Math.max(...profiles.map((p) => p.baseSpeedMax))
  return `${lo}–${hi} km/h`
}

function weatherLabel(s: SimRow): string {
  return (
    `${Math.round(s.temperature)}°C` +
    (s.wind > 0 ? ` · vent ${Math.round(s.wind)}` : '') +
    (s.rain ? ' · pluie' : '') +
    (s.fog ? ' · brouillard' : '')
  )
}

function departsLabel(s: SimRow): string {
  let races: RaceSnap[] = []
  try {
    if (s.racesSnapshot) races = JSON.parse(s.racesSnapshot) as RaceSnap[]
  } catch {
    races = []
  }
  if (races.length === 0) return '—'
  return races.map((r) => `${r.name} ${r.startTime ? `T+${r.startTime}` : 'T0'}`).join(' · ')
}

export default async function ComparePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { a, b } = await searchParams
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const event = await db.event.findUnique({
    where: { id },
    include: {
      simulations: {
        where: { status: 'DONE' },
        orderBy: { createdAt: 'desc' },
        include: { runnerProfiles: { select: { baseSpeedMin: true, baseSpeedMax: true } } },
      },
    },
  })
  if (!event || !canRead(await getEventAccess(session.user.id, event.id))) notFound()

  const sims = event.simulations as unknown as SimRow[]
  const options = sims.map((s) => ({ id: s.id, label: `${s.name} · ${fmtDate(s.createdAt)}` }))

  const simA = a ? sims.find((s) => s.id === a) : undefined
  const simB = b ? sims.find((s) => s.id === b) : undefined
  const ready = simA && simB

  const mA = simA ? computeMetrics(simA) : null
  const mB = simB ? computeMetrics(simB) : null

  // Rows of (label, valueA, valueB) — highlight when they differ
  const configRows: [string, string, string][] = ready
    ? [
        ['Date', fmtDate(simA!.createdAt), fmtDate(simB!.createdAt)],
        ['Départs', departsLabel(simA!), departsLabel(simB!)],
        ['Vitesses', speedLabel(simA!.runnerProfiles), speedLabel(simB!.runnerProfiles)],
        ['Coureurs', String(simA!.totalRunners), String(simB!.totalRunners)],
        ['Météo', weatherLabel(simA!), weatherLabel(simB!)],
        ['Runs', String(simA!.nRuns), String(simB!.nRuns)],
      ]
    : []

  const resultRows: [string, string, string][] = ready && mA && mB
    ? [
        ['1er arrivé (T+)', fmtDur(mA.firstFinish), fmtDur(mB.firstFinish)],
        ['DNF estimés', String(mA.dnf), String(mB.dnf)],
        ['Zones à risque', String(mA.zones), String(mB.zones)],
        ['Rencontres inter-courses', String(mA.rencontres), String(mB.rencontres)],
      ]
    : []

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Topbar activePage="results" eventId={event.id} eventName={event.name} eventLocation={event.location ?? undefined} />

      <main className="flex-1 px-6 py-8 max-w-4xl mx-auto w-full">
        <Link href={`/events/${event.id}/results`} className="inline-flex items-center gap-1.5 text-xs mb-4" style={{ color: 'var(--color-ink-3)' }}>
          <ArrowLeftIcon size={13} /> Historique
        </Link>

        <h1 className="text-xl font-semibold mb-1" style={{ color: 'var(--color-ink)' }}>
          Comparer deux simulations
        </h1>
        <p className="text-sm mb-5" style={{ color: 'var(--color-ink-3)' }}>
          Choisissez deux simulations pour confronter leur config et leurs résultats. Les valeurs
          différentes sont surlignées.
        </p>

        <div className="mb-6">
          <ComparePicker eventId={event.id} sims={options} a={a} b={b} />
        </div>

        {sims.length < 2 && (
          <p className="text-sm" style={{ color: 'var(--color-ink-4)' }}>
            Il faut au moins deux simulations terminées pour comparer.
          </p>
        )}

        {ready && (
          <div className="overflow-x-auto">
          <div className="rounded-xl overflow-hidden min-w-[360px]" style={{ border: '1px solid var(--color-line)' }}>
            <CompareHeader nameA={simA!.name} nameB={simB!.name} />
            <SectionLabel>Configuration</SectionLabel>
            {configRows.map((r) => (
              <CompareRow key={r[0]} label={r[0]} a={r[1]} b={r[2]} />
            ))}
            <SectionLabel>Résultats</SectionLabel>
            {resultRows.map((r) => (
              <CompareRow key={r[0]} label={r[0]} a={r[1]} b={r[2]} />
            ))}
            {/* Per-course winner duration (matched by course name) */}
            {mA && mB && mA.perRace.length > 0 && (
              <>
                <SectionLabel>1er arrivé par course (durée)</SectionLabel>
                {mA.perRace.map((ra) => {
                  const rb = mB.perRace.find((x) => x.id === ra.id || x.name === ra.name)
                  return (
                    <CompareRow
                      key={ra.id}
                      label={ra.name}
                      a={fmtDur(ra.duration)}
                      b={fmtDur(rb?.duration ?? null)}
                      dot={ra.color}
                    />
                  )
                })}
              </>
            )}
          </div>
          </div>
        )}
      </main>
    </div>
  )
}

function CompareHeader({ nameA, nameB }: { nameA: string; nameB: string }) {
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr]" style={{ background: 'var(--color-bg-2)' }}>
      <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
        Critère
      </div>
      <div className="px-3 py-2 text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>{nameA}</div>
      <div className="px-3 py-2 text-xs font-semibold truncate" style={{ color: 'var(--color-ink)' }}>{nameB}</div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ color: 'var(--color-ink-4)', background: 'var(--color-bg-1)', borderTop: '1px solid var(--color-line)' }}
    >
      {children}
    </div>
  )
}

function CompareRow({ label, a, b, dot }: { label: string; a: string; b: string; dot?: string }) {
  const differ = a !== b
  const valStyle = (side: boolean) => ({
    color: differ ? 'var(--color-ink)' : 'var(--color-ink-3)',
    fontWeight: differ ? 600 : 400,
    background: differ ? (side ? 'color-mix(in srgb, var(--color-lime) 8%, transparent)' : 'color-mix(in srgb, var(--color-warning) 8%, transparent)') : 'transparent',
  })
  return (
    <div className="grid grid-cols-[1.2fr_1fr_1fr] items-center" style={{ borderTop: '1px solid var(--color-line)' }}>
      <div className="px-3 py-2 text-[11.5px] flex items-center gap-1.5" style={{ color: 'var(--color-ink-3)' }}>
        {dot && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: dot }} />}
        {label}
      </div>
      <div className="px-3 py-2 text-[11.5px] font-mono" style={valStyle(true)}>{a}</div>
      <div className="px-3 py-2 text-[11.5px] font-mono" style={valStyle(false)}>{b}</div>
    </div>
  )
}
