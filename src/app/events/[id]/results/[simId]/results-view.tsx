'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { ElevationProfile } from './elevation-profile'
import { Timeline } from './timeline'
import { Topbar } from '@/components/layout/topbar'
import {
  LOGI_TYPES,
  logiStorageKey,
  logiTypeOf,
  type PlacedLogi,
} from './logistics'
import {
  MapIcon,
  AlertTriangleIcon,
  ZapIcon,
  UsersIcon,
  EyeIcon,
  EyeOffIcon,
  ChevronDownIcon,
  BarChart3Icon,
  FlagIcon,
  TrendingDownIcon,
  MapPinIcon,
  Trash2Icon,
  XIcon,
  LayersIcon,
} from 'lucide-react'
import { RiskBadge } from '@/components/layout/risk-badge'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'

const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'var(--color-bg)' }} />,
})

export interface ResultsViewProps {
  event: { id: string; name: string; location?: string | null; date?: Date | null }
  simulation: {
    id: string
    name: string
    totalRunners: number
    temperature: number
    wind: number
    rain: boolean
    fog: boolean
    logistique?: string
  }
  result: CompressedSimulationResult | null
  races: {
    id: string
    name: string
    color: string
    distance: number
    elevGain: number
    startTime: number
    gpxPoints: GPXPoint[]
  }[]
  runnerProfiles: {
    id: string
    label: string
    color: string
    percentage: number
    abandonRate: number
  }[]
}

function formatTimeHHMM(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

interface ClusteredRisk {
  raceId: string
  segmentIndex: number
  riskScore: number
  jamProbability: number
  peakDensity: number
  dist: number
  kind: 'bouchon' | 'affluence'
}

/**
 * Merge near-duplicate risk segments. A dense GPX track produces one risk
 * entry per ~20 m point, so the start line alone can yield dozens of rows.
 * Group consecutive entries (per race, within `gapKm`) and keep the worst one.
 */
function clusterRiskZones(
  entries: { raceId: string; segmentIndex: number; riskScore: number; jamProbability: number; peakDensity: number; kind?: 'bouchon' | 'affluence' }[],
  races: { id: string; gpxPoints: GPXPoint[] }[],
  gapKm = 0.4
): ClusteredRisk[] {
  const byRace = new Map<string, ClusteredRisk[]>()
  for (const e of entries) {
    const race = races.find((r) => r.id === e.raceId)
    const dist = race?.gpxPoints[e.segmentIndex]?.dist ?? 0
    if (!byRace.has(e.raceId)) byRace.set(e.raceId, [])
    byRace.get(e.raceId)!.push({ ...e, dist, kind: e.kind ?? 'affluence' })
  }

  const out: ClusteredRisk[] = []
  for (const list of byRace.values()) {
    list.sort((a, b) => a.dist - b.dist)
    let cluster: ClusteredRisk[] = []
    const flush = () => {
      if (cluster.length === 0) return
      const best = cluster.reduce((m, c) => (c.riskScore > m.riskScore ? c : m), cluster[0])
      out.push({
        ...best,
        peakDensity: Math.max(...cluster.map((c) => c.peakDensity)),
        jamProbability: Math.max(...cluster.map((c) => c.jamProbability)),
        // Bouchon takes priority if any sub-segment in the cluster is one
        kind: cluster.some((c) => c.kind === 'bouchon') ? 'bouchon' : 'affluence',
      })
      cluster = []
    }
    for (const e of list) {
      if (cluster.length > 0 && e.dist - cluster[cluster.length - 1].dist > gapKm) flush()
      cluster.push(e)
    }
    flush()
  }
  return out
}

function Section({
  icon,
  label,
  count,
  defaultOpen = true,
  children,
}: {
  icon: React.ReactNode
  label: string
  count?: number
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-4 py-2.5 border-b w-full text-left select-none cursor-pointer"
        style={{ borderColor: 'var(--color-line)', background: 'var(--color-bg)' }}
      >
        <span style={{ color: 'var(--color-lime)' }}>{icon}</span>
        <span
          className="text-xs font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-ink-3)' }}
        >
          {label}
        </span>
        {count != null && count > 0 && (
          <span
            className="text-[10px] font-mono px-1.5 py-0.5 rounded-full"
            style={{ background: 'var(--color-bg-2)', color: 'var(--color-ink-4)' }}
          >
            {count}
          </span>
        )}
        <span
          className="ml-auto transition-transform duration-200"
          style={{
            color: 'var(--color-ink-4)',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          <ChevronDownIcon size={14} />
        </span>
      </button>
      {open && children}
    </div>
  )
}

/** Pill toggle-switch tile used in the "Couches actives" section. */
function LayerSwitch({
  label,
  on,
  onClick,
}: {
  label: string
  on: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left select-none transition-colors"
      style={{
        background: 'var(--color-bg-2)',
        border: '1px solid var(--color-line)',
        color: on ? 'var(--color-ink)' : 'var(--color-ink-3)',
      }}
    >
      {/* Switch pill */}
      <span
        className="relative shrink-0 rounded-full transition-colors"
        style={{
          width: 28,
          height: 16,
          background: on
            ? 'color-mix(in oklab, var(--color-lime) 35%, transparent)'
            : 'var(--color-bg)',
          border: `1px solid ${on ? 'var(--color-lime)' : 'var(--color-line)'}`,
        }}
      >
        <span
          className="absolute rounded-full transition-transform"
          style={{
            top: 1,
            left: 1,
            width: 12,
            height: 12,
            background: on ? 'var(--color-lime)' : 'var(--color-ink-4)',
            transform: on ? 'translateX(12px)' : 'translateX(0)',
          }}
        />
      </span>
      <span className="text-xs">{label}</span>
    </button>
  )
}

function StatTile({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
  sub?: string
  tone?: 'warning'
}) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2.5 rounded-lg"
      style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
    >
      <span className="flex items-center gap-1.5 text-[10px]" style={{ color: 'var(--color-ink-4)' }}>
        <span style={{ color: 'var(--color-ink-3)' }}>{icon}</span>
        {label}
      </span>
      <span
        className="font-mono text-lg font-bold tabular-nums leading-none"
        style={{ color: tone === 'warning' ? 'var(--color-warning)' : 'var(--color-ink)' }}
      >
        {value}
      </span>
      {sub && (
        <span className="text-[10px] truncate" style={{ color: 'var(--color-ink-4)' }}>
          {sub}
        </span>
      )}
    </div>
  )
}

export function ResultsView({
  event,
  simulation,
  result,
  races,
}: ResultsViewProps) {
  const [visibleRaces, setVisibleRaces] = useState<Set<string>>(
    () => new Set(races.map((r) => r.id))
  )
  const [highlightedSegment, setHighlightedSegment] = useState<{
    raceId: string
    segmentIndex: number
  } | null>(null)
  const [highlightedCollision, setHighlightedCollision] = useState<number | null>(null)

  const toggleRace = useCallback((raceId: string) => {
    setVisibleRaces((prev) => {
      const next = new Set(prev)
      if (next.has(raceId)) {
        next.delete(raceId)
      } else {
        next.add(raceId)
      }
      return next
    })
  }, [])

  // --- Timeline / playback state ---
  const rawTimestamps = useMemo(() => result?.globalTimestamps ?? [], [result])
  const runnersData = useMemo(() => result?.runnersData ?? [], [result])
  // Cap the timeline to the last moment a runner is still on course, so the
  // playback ends with the last finisher instead of a long empty tail.
  const maxIndex = useMemo(() => {
    let last = 0
    for (let t = 0; t < rawTimestamps.length; t++) {
      let active = false
      for (const r of runnersData) {
        const p = r.positions[t] ?? 0
        if (p > 0 && p < 1) {
          active = true
          break
        }
      }
      if (active) last = t
    }
    return Math.min(Math.max(0, rawTimestamps.length - 1), last + 2)
  }, [rawTimestamps, runnersData])
  const timestamps = useMemo(() => rawTimestamps.slice(0, maxIndex + 1), [rawTimestamps, maxIndex])
  const [timeIndex, setTimeIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1) // playback multiplier
  // Map layers ("Couches actives")
  const [layers, setLayers] = useState({
    runners: true,
    zones: true,
    shared: false,
    collisions: true,
    density: true,
    heat: false,
    logistique: false,
  })
  const setLayer = useCallback((name: keyof typeof layers, on: boolean) => {
    setLayers((s) => ({ ...s, [name]: on }))
  }, [])
  // Hovered point on the elevation profile -> marker following the trace on the map
  const [hoverPoint, setHoverPoint] = useState<[number, number] | null>(null)
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Logistics: seeded from the configuration (simulation.logistique),
  // with local tweaks persisted to localStorage per simulation ---
  const [placedLogistics, setPlacedLogistics] = useState<PlacedLogi[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(logiStorageKey(simulation.id))
      if (raw) return JSON.parse(raw) as PlacedLogi[]
    } catch {
      /* ignore */
    }
    // Fall back to the logistics defined during configuration
    try {
      if (simulation.logistique) return JSON.parse(simulation.logistique) as PlacedLogi[]
    } catch {
      /* ignore */
    }
    return []
  })
  const [placementType, setPlacementType] = useState<string | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(logiStorageKey(simulation.id), JSON.stringify(placedLogistics))
    } catch {
      /* quota */
    }
  }, [placedLogistics, simulation.id])

  const placeLogi = useCallback(
    (lat: number, lng: number) => {
      setPlacementType((type) => {
        if (!type) return null
        const id =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `logi-${Date.now()}-${Math.random().toString(36).slice(2)}`
        setPlacedLogistics((prev) => [...prev, { id, type, lat, lng }])
        return null // exit placement mode after a single placement
      })
    },
    []
  )

  const moveLogi = useCallback((id: string, lat: number, lng: number) => {
    setPlacedLogistics((prev) => prev.map((l) => (l.id === id ? { ...l, lat, lng } : l)))
  }, [])

  const removeLogi = useCallback((id: string) => {
    setPlacedLogistics((prev) => prev.filter((l) => l.id !== id))
  }, [])

  // Count placed logistics per type
  const logiCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const l of placedLogistics) counts[l.type] = (counts[l.type] ?? 0) + 1
    return counts
  }, [placedLogistics])

  useEffect(() => {
    if (!playing) {
      if (playRef.current) clearInterval(playRef.current)
      playRef.current = null
      return
    }
    playRef.current = setInterval(() => {
      setTimeIndex((i) => {
        if (i >= maxIndex) {
          setPlaying(false)
          return maxIndex
        }
        return i + 1
      })
    }, Math.max(16, 120 / speed))
    return () => {
      if (playRef.current) clearInterval(playRef.current)
      playRef.current = null
    }
  }, [playing, maxIndex, speed])

  // Runners on course per race at the active time (for the map legend)
  const liveByRace = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of runnersData) {
      const p = r.positions[timeIndex] ?? 0
      if (p > 0 && p < 1) m.set(r.raceId, (m.get(r.raceId) ?? 0) + 1)
    }
    return m
  }, [runnersData, timeIndex])

  // Runners currently on course (started, not finished) at the active time
  const runnersOnCourse = useMemo(() => {
    let n = 0
    for (const r of runnersData) {
      const p = r.positions[timeIndex] ?? 0
      if (p > 0 && p < 1) n++
    }
    return n
  }, [runnersData, timeIndex])

  // Leader distance (km) per race at the active time → progress cursor.
  // Include finished runners (clamp to 1) so the cursor stays at the end
  // instead of snapping back to 0 once everyone has finished.
  const leaderDistByRace = useMemo(() => {
    const totals = new Map<string, number>()
    for (const race of races) {
      if (race.gpxPoints.length > 0) {
        totals.set(race.id, race.gpxPoints[race.gpxPoints.length - 1].dist)
      }
    }
    const out: Record<string, number> = {}
    for (const r of runnersData) {
      const total = totals.get(r.raceId)
      if (total == null) continue
      const p = Math.min(1, r.positions[timeIndex] ?? 0)
      const d = p * total
      if (d > (out[r.raceId] ?? 0)) out[r.raceId] = d
    }
    return out
  }, [runnersData, timeIndex, races])

  const rawRiskMap = useMemo(() => result?.riskMap ?? [], [result])
  const collisionWindows = useMemo(() => result?.collisionWindows ?? [], [result])

  // Merge near-duplicate risk segments before display / mapping
  const riskMap = useMemo(() => clusterRiskZones(rawRiskMap, races), [rawRiskMap, races])

  // Sort risk entries by score descending
  const sortedRiskMap = useMemo(
    () => [...riskMap].sort((a, b) => b.riskScore - a.riskScore),
    [riskMap]
  )

  // Set of "raceId:segmentIndex" that have a collision window (for the zone badge)
  const collisionSegments = useMemo(() => {
    const set = new Set<string>()
    for (const cw of collisionWindows) {
      for (const rid of cw.raceIds) set.add(`${rid}:${cw.segmentIndex}`)
    }
    return set
  }, [collisionWindows])

  // First finisher: earliest time any runner reaches the finish, + which race
  const firstFinish = useMemo(() => {
    let best = Infinity
    let raceId: string | null = null
    for (const r of runnersData) {
      for (let t = 0; t < r.positions.length; t++) {
        if (r.positions[t] >= 1) {
          const sec = rawTimestamps[t]
          if (sec != null && sec < best) {
            best = sec
            raceId = r.raceId
          }
          break
        }
      }
    }
    return isFinite(best) ? { seconds: best, raceId } : null
  }, [runnersData, rawTimestamps])

  // DNF = runners who never reach the finish (they abandoned). Counted from the
  // simulated trajectories, so it reflects the weather's effect on abandons.
  const dnfEstimate = useMemo(() => {
    let dnf = 0
    for (const r of runnersData) {
      let maxPos = 0
      for (const p of r.positions) if (p > maxPos) maxPos = p
      if (maxPos < 0.999) dnf++
    }
    return dnf
  }, [runnersData])

  // Peak LOCAL crowding per race: the most runners concentrated within any
  // ~150 m stretch at any moment (the real figure for sizing a post / safety),
  // not the whole-course headcount which is ~always the number of entrants.
  const maxLocalByRace = useMemo(() => {
    const BIN_KM = 0.15
    const totals = new Map<string, number>()
    for (const race of races) {
      if (race.gpxPoints.length > 0) totals.set(race.id, race.gpxPoints[race.gpxPoints.length - 1].dist)
    }
    const max = new Map<string, number>()
    for (let t = 0; t < timestamps.length; t++) {
      const binCounts = new Map<string, number>()
      for (const r of runnersData) {
        const p = r.positions[t] ?? 0
        if (p <= 0 || p >= 1) continue
        const total = totals.get(r.raceId) ?? 0
        const bin = total > 0 ? Math.floor((p * total) / BIN_KM) : 0
        const key = `${r.raceId}#${bin}`
        binCounts.set(key, (binCounts.get(key) ?? 0) + 1)
      }
      for (const [key, c] of binCounts) {
        const raceId = key.slice(0, key.lastIndexOf('#'))
        if (c > (max.get(raceId) ?? 0)) max.set(raceId, c)
      }
    }
    return max
  }, [runnersData, races, timestamps])

  const maxLocalAll = useMemo(() => {
    let m = 0
    for (const v of maxLocalByRace.values()) m = Math.max(m, v)
    return m
  }, [maxLocalByRace])

  // Per-course breakdown of the key stats
  const perRaceStats = useMemo(() => {
    return races.map((race) => {
      const rRunners = runnersData.filter((r) => r.raceId === race.id)
      let firstSec = Infinity
      let departSec = Infinity
      let dnf = 0
      for (const r of rRunners) {
        let maxPos = 0
        let moved = false
        for (let t = 0; t < r.positions.length; t++) {
          const p = r.positions[t]
          if (p > maxPos) maxPos = p
          // First instant this runner is moving = its wave's actual départure
          // in the SNAPSHOT (immune to later edits of race.startTime).
          if (!moved && p > 0) {
            moved = true
            const s = rawTimestamps[t]
            if (s != null && s < departSec) departSec = s
          }
          if (p >= 1) {
            const s = rawTimestamps[t]
            if (s != null && s < firstSec) firstSec = s
            break
          }
        }
        if (maxPos < 0.999) dnf++
      }
      const zones = riskMap.filter((e) => e.raceId === race.id).length
      return {
        id: race.id,
        name: race.name,
        color: race.color,
        total: rRunners.length,
        // Winner's running time = finish − the wave's departure, both read from
        // the stored trajectory, so a staggered start is excluded correctly even
        // if race.startTime was changed after the run.
        firstDuration: isFinite(firstSec)
          ? firstSec - (isFinite(departSec) ? departSec : 0)
          : null,
        dnf,
        maxLocal: maxLocalByRace.get(race.id) ?? 0,
        zones,
      }
    })
  }, [races, runnersData, rawTimestamps, riskMap, maxLocalByRace])

  // Per-course profile mix, from the actually simulated runners
  const profilesByRace = useMemo(() => {
    return races.map((race) => {
      const rr = runnersData.filter((r) => r.raceId === race.id)
      const total = rr.length
      const byLabel = new Map<string, { label: string; color: string; count: number }>()
      for (const r of rr) {
        const e = byLabel.get(r.profileLabel) ?? { label: r.profileLabel, color: r.color, count: 0 }
        e.count++
        byLabel.set(r.profileLabel, e)
      }
      const profiles = [...byLabel.values()]
        .map((e) => ({ ...e, percentage: total > 0 ? (e.count / total) * 100 : 0 }))
        .sort((a, b) => b.percentage - a.percentage)
      return { id: race.id, name: race.name, color: race.color, total, profiles }
    })
  }, [races, runnersData])

  const maxPeakDensity = useMemo(
    () => Math.max(1, ...riskMap.map((e) => e.peakDensity)),
    [riskMap]
  )

  return (
    <div
      className="flex flex-col"
      style={{ height: '100vh', background: 'var(--color-bg)', color: 'var(--color-ink)' }}
    >
      {/* Topbar */}
      <Topbar
        activePage="results"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        status="results"
        exportHref={`/events/${event.id}/report/${simulation.id}`}
      />

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Left column: map + elevation profile */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 relative min-h-0">
            <LeafletMap
              races={races}
              riskMap={riskMap}
              rawRiskMap={rawRiskMap}
              collisionWindows={collisionWindows}
              visibleRaces={visibleRaces}
              highlightedSegment={highlightedSegment}
              highlightedCollision={highlightedCollision}
              runnersData={runnersData}
              timeIndex={timeIndex}
              currentSec={timestamps[timeIndex] ?? 0}
              showRunners={layers.runners}
              showZones={layers.zones}
              showShared={layers.shared}
              showCollisions={layers.collisions}
              showDensity={layers.density}
              showHeat={layers.heat}
              showLogistics={layers.logistique}
              hoverPoint={hoverPoint}
              placedLogistics={placedLogistics}
              placementType={placementType}
              onPlace={placeLogi}
              onMoveLogi={moveLogi}
              onRemoveLogi={removeLogi}
            />

            {/* Course legend — colour = course, with live on-course count */}
            {races.length > 0 && (
              <div
                className="absolute top-3 left-3 z-[1000] flex flex-col gap-1 px-2.5 py-2 rounded-lg shadow-lg"
                style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
              >
                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'var(--color-ink-4)' }}>
                  Courses · en piste
                </span>
                {races.map((race) => (
                  <button
                    key={race.id}
                    type="button"
                    onClick={() => toggleRace(race.id)}
                    className="flex items-center gap-1.5"
                    style={{ opacity: visibleRaces.has(race.id) ? 1 : 0.4 }}
                  >
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: race.color }} />
                    <span className="text-[11px]" style={{ color: 'var(--color-ink-2)' }}>
                      {race.name}
                    </span>
                    <span className="ml-auto text-[10px] font-mono tabular-nums" style={{ color: 'var(--color-lime)' }}>
                      {liveByRace.get(race.id) ?? 0}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Placement-mode banner */}
            {placementType && (
              <div
                className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg"
                style={{
                  background: 'var(--color-bg-1)',
                  border: '1px solid var(--color-lime)',
                  color: 'var(--color-ink)',
                }}
              >
                <MapPinIcon size={14} style={{ color: 'var(--color-lime)' }} />
                <span className="text-xs font-medium">
                  Cliquez sur la carte pour placer&nbsp;:{' '}
                  <b style={{ color: logiTypeOf(placementType).color }}>
                    {logiTypeOf(placementType).label}
                  </b>
                </span>
                <button
                  type="button"
                  onClick={() => setPlacementType(null)}
                  className="ml-1"
                  style={{ color: 'var(--color-ink-4)' }}
                  aria-label="Annuler"
                >
                  <XIcon size={14} />
                </button>
              </div>
            )}
          </div>
          <ElevationProfile
            races={races}
            riskMap={riskMap}
            visibleRaces={visibleRaces}
            cursorByRace={leaderDistByRace}
            onHover={setHoverPoint}
          />
        </div>

        {/* Right panel */}
        <aside
          className="shrink-0 overflow-y-auto border-l flex flex-col"
          style={{
            width: 340,
            background: 'var(--color-bg-1)',
            borderColor: 'var(--color-line)',
          }}
        >
          {/* COUCHES ACTIVES section */}
          <Section icon={<LayersIcon size={12} />} label="Couches actives">
            <div className="p-3 grid grid-cols-2 gap-1.5">
              <LayerSwitch label="Coureurs" on={layers.runners} onClick={() => setLayer('runners', !layers.runners)} />
              <LayerSwitch label="Zones risque" on={layers.zones} onClick={() => setLayer('zones', !layers.zones)} />
              <LayerSwitch label="Tronçons communs" on={layers.shared} onClick={() => setLayer('shared', !layers.shared)} />
              <LayerSwitch label="Rencontres" on={layers.collisions} onClick={() => setLayer('collisions', !layers.collisions)} />
              <LayerSwitch label="Densité live" on={layers.density} onClick={() => setLayer('density', !layers.density)} />
              <LayerSwitch label="Heatmap" on={layers.heat} onClick={() => setLayer('heat', !layers.heat)} />
              <LayerSwitch label="Logistique" on={layers.logistique} onClick={() => setLayer('logistique', !layers.logistique)} />
            </div>
            <p className="px-3 pb-3 -mt-1 text-[10px] leading-relaxed" style={{ color: 'var(--color-ink-4)' }}>
              <b style={{ color: 'var(--color-ink-3)' }}>Densité live</b> = affluence à l&apos;instant
              de la timeline (évolue quand vous jouez). <b style={{ color: 'var(--color-ink-3)' }}>Heatmap</b> =
              points chauds cumulés sur toute la course (vue d&apos;ensemble figée).
            </p>
          </Section>

          {/* STATISTIQUES section */}
          <Section icon={<BarChart3Icon size={12} />} label="Statistiques simulation">
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatTile
                icon={<FlagIcon size={12} />}
                label="1er arrivé (T+)"
                value={firstFinish ? formatTimeHHMM(firstFinish.seconds) : '—'}
                sub={
                  firstFinish
                    ? races.find((r) => r.id === firstFinish.raceId)?.name ?? 'course inconnue'
                    : 'toutes courses'
                }
              />
              <StatTile
                icon={<TrendingDownIcon size={12} />}
                label="DNF estimés"
                value={`≈ ${dnfEstimate}`}
                sub="toutes courses"
                tone="warning"
              />
              <StatTile
                icon={<UsersIcon size={12} />}
                label="Affluence max"
                value={String(maxLocalAll)}
                sub="coureurs / 150 m"
              />
              <StatTile
                icon={<AlertTriangleIcon size={12} />}
                label="Zones à risque"
                value={String(riskMap.length)}
                sub="toutes courses"
              />
            </div>

            {/* Per-course detail */}
            {perRaceStats.length > 0 && (
              <div className="px-3 pb-3">
                <div
                  className="text-[10px] font-semibold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--color-ink-4)' }}
                >
                  Détail par course
                </div>
                <div className="flex flex-col gap-1.5">
                  {perRaceStats.map((s) => (
                    <div
                      key={s.id}
                      className="rounded-lg px-2.5 py-2"
                      style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                        <span className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>
                          {s.name}
                        </span>
                        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                          {s.total} crs
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1 text-center">
                        <div>
                          <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-ink)' }}>
                            {s.firstDuration != null ? formatTimeHHMM(s.firstDuration) : '—'}
                          </div>
                          <div className="text-[9px]" style={{ color: 'var(--color-ink-4)' }}>1er (durée)</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-warning)' }}>
                            {s.dnf}
                          </div>
                          <div className="text-[9px]" style={{ color: 'var(--color-ink-4)' }}>DNF</div>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-ink)' }}>
                            {s.maxLocal}
                          </div>
                          <div className="text-[9px]" style={{ color: 'var(--color-ink-4)' }} title="Pic de coureurs sur 150 m">
                            affluence/150m
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] font-mono tabular-nums" style={{ color: 'var(--color-ink)' }}>
                            {s.zones}
                          </div>
                          <div className="text-[9px]" style={{ color: 'var(--color-ink-4)' }}>zones</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>

          {/* COURSES section */}
          <Section icon={<MapIcon size={12} />} label="Courses" count={races.length}>
            <div className="p-3 flex flex-col gap-1">
              {races.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune course configurée.
                </p>
              )}
              {races.map((race) => {
                const isVisible = visibleRaces.has(race.id)
                return (
                  <button
                    key={race.id}
                    onClick={() => toggleRace(race.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors"
                    style={{
                      background: isVisible ? 'var(--color-bg-2)' : 'transparent',
                      border: '1px solid',
                      borderColor: isVisible ? 'var(--color-line)' : 'transparent',
                      opacity: isVisible ? 1 : 0.42,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: race.color, filter: isVisible ? 'none' : 'grayscale(1)' }}
                    />
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{
                        color: isVisible ? 'var(--color-ink)' : 'var(--color-ink-4)',
                      }}
                    >
                      {race.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: 'var(--color-bg)',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      {race.distance.toFixed(1)} km
                    </span>
                    <span style={{ color: 'var(--color-ink-4)' }}>
                      {isVisible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ZONES À RISQUE section */}
          <Section
            icon={<AlertTriangleIcon size={12} />}
            label="Zones à risque"
            count={sortedRiskMap.length}
          >
            <div className="p-3 flex flex-col gap-1">
              {sortedRiskMap.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune zone à risque détectée.
                </p>
              )}
              {sortedRiskMap.slice(0, 20).map((entry, i) => {
                const race = races.find((r) => r.id === entry.raceId)
                const point = race?.gpxPoints[entry.segmentIndex]
                const dist = point?.dist ?? 0
                const isHL =
                  highlightedSegment?.raceId === entry.raceId &&
                  highlightedSegment?.segmentIndex === entry.segmentIndex
                const zoneColor =
                  entry.riskScore >= 0.8
                    ? 'var(--color-danger)'
                    : entry.riskScore >= 0.5
                      ? 'var(--color-warning)'
                      : 'var(--color-safe)'
                const densityPct = Math.min(100, (entry.peakDensity / maxPeakDensity) * 100)
                const hasCollision = collisionSegments.has(`${entry.raceId}:${entry.segmentIndex}`)

                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1.5 px-3 py-2 rounded-lg transition-colors"
                    style={{
                      background: isHL ? 'var(--color-bg-2)' : 'transparent',
                      border: '1px solid',
                      borderColor: isHL ? 'var(--color-line)' : 'transparent',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: zoneColor }} />
                      <span className="flex-1 text-xs truncate" style={{ color: 'var(--color-ink-3)' }}>
                        {race?.name ?? entry.raceId}
                        <span className="ml-1.5 font-mono" style={{ color: 'var(--color-ink-4)' }}>
                          km {dist.toFixed(1)}
                        </span>
                      </span>
                      <span
                        className="text-[9px] font-semibold px-1 py-0.5 rounded shrink-0"
                        style={{
                          background:
                            entry.kind === 'bouchon'
                              ? 'color-mix(in srgb, var(--color-danger) 18%, transparent)'
                              : 'color-mix(in srgb, var(--color-warning) 18%, transparent)',
                          color: entry.kind === 'bouchon' ? 'var(--color-danger)' : 'var(--color-warning)',
                        }}
                      >
                        {entry.kind === 'bouchon' ? 'Bouchon' : 'Affluence'}
                      </span>
                      {hasCollision && (
                        <span
                          className="flex items-center gap-0.5 text-[9px] font-semibold px-1 py-0.5 rounded"
                          style={{
                            background: 'color-mix(in srgb, var(--color-danger) 18%, transparent)',
                            color: 'var(--color-danger)',
                          }}
                          title="Fenêtre de collision sur cette zone"
                        >
                          <ZapIcon size={9} />
                          Collision
                        </span>
                      )}
                      <RiskBadge score={Math.round(entry.riskScore * 100)} />
                    </div>

                    {/* Density bar: peak runners vs busiest zone */}
                    <div className="flex items-center gap-2">
                      <div
                        className="flex-1 h-1.5 rounded-full overflow-hidden"
                        style={{ background: 'var(--color-bg)' }}
                      >
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${densityPct}%`, background: zoneColor, opacity: 0.85 }}
                        />
                      </div>
                      <span className="text-[10px] font-mono shrink-0" style={{ color: 'var(--color-ink-4)' }}>
                        {entry.peakDensity.toFixed(0)} crs/150m
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                        {entry.kind === 'bouchon'
                          ? `Bloqué ${Math.round(entry.jamProbability * 100)}% du temps`
                          : 'Forte concentration (fluide)'}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          setHighlightedSegment(
                            isHL ? null : { raceId: entry.raceId, segmentIndex: entry.segmentIndex }
                          )
                        }
                        className="flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded transition-colors"
                        style={{ color: 'var(--color-lime)' }}
                      >
                        <MapIcon size={10} />
                        Voir
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* COLLISIONS / RENCONTRES section */}
          <Section
            icon={<ZapIcon size={12} />}
            label="Rencontres inter-courses"
            count={collisionWindows.length}
          >
            <div className="p-3 flex flex-col gap-2">
              <p className="text-[11px] leading-relaxed px-0.5" style={{ color: 'var(--color-ink-4)' }}>
                Moments où le peloton d&apos;une course en rejoint un autre sur un tronçon commun —
                p. ex. les premiers d&apos;une course partie en différé rattrapant les derniers de la
                précédente (le départ est exclu).
              </p>
              {races.length >= 2 && collisionWindows.length > 0 && (
                <p
                  className="text-[10.5px] leading-relaxed px-2 py-1.5 rounded-md"
                  style={{ color: 'var(--color-ink-3)', background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
                >
                  ⓘ Ces plages sont <strong>probabilistes</strong> : calculées sur l&apos;ensemble des
                  simulations, elles s&apos;ouvrent dès que la rencontre devient possible. Le timelapse
                  n&apos;affiche <strong>qu&apos;un seul scénario</strong> — les coureurs visibles peuvent
                  donc se croiser <strong>plus tard</strong> à l&apos;intérieur de la plage.
                </p>
              )}

              {races.length < 2 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Une seule course : pas de rencontre inter-courses possible. Les engorgements
                  internes apparaissent dans « Zones à risque ».
                </p>
              )}
              {races.length >= 2 && collisionWindows.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune rencontre détectée : les courses ne se superposent pas, ou jamais en même
                  temps.
                </p>
              )}

              {collisionWindows.map((cw, i) => {
                const resolved = cw.raceIds.map(
                  (rid) => races.find((r) => r.id === rid) ?? null
                )
                const ptRace = resolved[0]
                const dist = ptRace?.gpxPoints[cw.segmentIndex]?.dist
                const isHL = highlightedCollision === i
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setHighlightedCollision(isHL ? null : i)}
                    className="flex flex-col gap-1.5 px-3 py-2.5 rounded-lg text-left w-full transition-colors"
                    style={{
                      background: 'var(--color-bg-2)',
                      border: '1px solid',
                      borderColor: isHL ? 'var(--color-lime)' : 'var(--color-line)',
                    }}
                  >
                    {/* Which courses meet */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {resolved.map((r, j) => (
                        <span key={j} className="flex items-center gap-1">
                          {j > 0 && (
                            <span className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>
                              ↔
                            </span>
                          )}
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ background: r?.color ?? 'var(--color-ink-4)' }}
                          />
                          <span className="text-xs font-medium" style={{ color: 'var(--color-ink-2)' }}>
                            {r?.name ?? 'Course supprimée'}
                          </span>
                        </span>
                      ))}
                    </div>

                    {/* When */}
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
                        Plage probable
                      </span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-2)' }}>
                        {formatTimeHHMM(cw.tStart)}
                      </span>
                      <span style={{ color: 'var(--color-ink-4)' }}>→</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-3)' }}>
                        {formatTimeHHMM(cw.tEnd)}
                      </span>
                    </div>

                    {/* Where + intensity */}
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                        {dist != null ? `km ${dist.toFixed(1)}` : `segment ${cw.segmentIndex}`}
                      </span>
                      <span
                        className="text-[11px] font-mono"
                        style={{ color: cw.peak >= 25 ? 'var(--color-danger)' : 'var(--color-warning)' }}
                      >
                        jusqu&apos;à {Math.round(cw.peak)} coureurs
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* PROFILS section */}
          <Section icon={<UsersIcon size={12} />} label="Profils par course" count={races.length} defaultOpen={false}>
            <div className="p-3 flex flex-col gap-3">
              {profilesByRace.every((r) => r.profiles.length === 0) && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucun profil — relancez une simulation.
                </p>
              )}
              {profilesByRace.map(
                (race) =>
                  race.profiles.length > 0 && (
                    <div key={race.id} className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: race.color }} />
                        <span className="text-xs font-semibold" style={{ color: 'var(--color-ink-2)' }}>
                          {race.name}
                        </span>
                        <span className="ml-auto text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                          {race.total} crs
                        </span>
                      </div>
                      {race.profiles.map((p) => (
                        <div key={p.label} className="flex flex-col gap-1 pl-3.5">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
                            <span className="flex-1 text-xs truncate" style={{ color: 'var(--color-ink-3)' }}>
                              {p.label}
                            </span>
                            <span className="text-[11px] font-mono" style={{ color: 'var(--color-ink-3)' }}>
                              {Math.round((p.percentage / 100) * race.total)} · {p.percentage.toFixed(0)}%
                            </span>
                          </div>
                          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--color-bg)' }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.min(p.percentage, 100)}%`, background: p.color, opacity: 0.8 }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )
              )}
            </div>
          </Section>

          {/* LOGISTIQUE TERRAIN section */}
          <Section
            icon={<MapPinIcon size={12} />}
            label="Logistique terrain"
            count={placedLogistics.length}
            defaultOpen={false}
          >
            <div className="p-3 flex flex-col gap-3">
              <p className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>
                Choisissez un type puis cliquez sur la carte. Les marqueurs sont déplaçables et
                sauvegardés automatiquement.
              </p>

              {/* Type buttons */}
              <div className="grid grid-cols-2 gap-1.5">
                {LOGI_TYPES.map((t) => {
                  const active = placementType === t.type
                  return (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => setPlacementType((cur) => (cur === t.type ? null : t.type))}
                      className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left transition-colors"
                      style={{
                        background: active ? 'var(--color-bg-2)' : 'transparent',
                        border: '1px solid',
                        borderColor: active ? t.color : 'var(--color-line)',
                      }}
                    >
                      <span
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold text-white"
                        style={{ background: t.color }}
                      >
                        {t.letter}
                      </span>
                      <span className="flex-1 text-xs" style={{ color: 'var(--color-ink-2)' }}>
                        {t.label}
                      </span>
                      {(logiCounts[t.type] ?? 0) > 0 && (
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: 'var(--color-ink-4)' }}
                        >
                          ×{logiCounts[t.type]}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* Placed list */}
              {placedLogistics.length > 0 && (
                <div className="flex flex-col gap-1 pt-1 border-t" style={{ borderColor: 'var(--color-line)' }}>
                  {placedLogistics.map((l) => {
                    const meta = logiTypeOf(l.type)
                    return (
                      <div key={l.id} className="flex items-center gap-2 px-1 py-1">
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                          style={{ background: meta.color }}
                        >
                          {meta.letter}
                        </span>
                        <span className="flex-1 text-xs truncate" style={{ color: 'var(--color-ink-3)' }}>
                          {meta.label}
                        </span>
                        <span
                          className="text-[10px] font-mono"
                          style={{ color: 'var(--color-ink-4)' }}
                        >
                          {l.lat.toFixed(3)}, {l.lng.toFixed(3)}
                        </span>
                        <button
                          type="button"
                          onClick={() => removeLogi(l.id)}
                          style={{ color: 'var(--color-ink-4)' }}
                          aria-label="Supprimer"
                          className="hover:text-[var(--color-danger)] transition-colors"
                        >
                          <Trash2Icon size={12} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </Section>

          {/* Bottom spacer */}
          <div className="flex-1" />

          {/* Simulation meta */}
          <div
            className="px-4 py-3 border-t text-xs"
            style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-4)' }}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>{simulation.totalRunners} coureurs</span>
              <span>{simulation.temperature}°C</span>
              <span>Vent {simulation.wind} km/h</span>
              {simulation.rain && <span style={{ color: 'var(--color-warning)' }}>Pluie</span>}
              {simulation.fog && <span style={{ color: 'var(--color-warning)' }}>Brouillard</span>}
            </div>
          </div>
        </aside>
      </div>

      {/* Timeline transport */}
      <Timeline
        timestamps={timestamps}
        timeIndex={timeIndex}
        playing={playing}
        runnersOnCourse={runnersOnCourse}
        totalRunners={simulation.totalRunners}
        speed={speed}
        onSpeedChange={setSpeed}
        onScrub={(i) => {
          setPlaying(false)
          setTimeIndex(i)
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
        onStepStart={() => {
          setPlaying(false)
          setTimeIndex(0)
        }}
        onStepEnd={() => {
          setPlaying(false)
          setTimeIndex(maxIndex)
        }}
      />
    </div>
  )
}
