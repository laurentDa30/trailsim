'use client'

import { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ElevationProfile } from './elevation-profile'
import { Timeline } from './timeline'
import {
  LOGI_TYPES,
  logiStorageKey,
  logiTypeOf,
  type PlacedLogi,
} from './logistics'
import {
  ArrowLeftIcon,
  FileTextIcon,
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
import { Button } from '@/components/ui/button'
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
  }
  result: CompressedSimulationResult | null
  races: {
    id: string
    name: string
    color: string
    distance: number
    elevGain: number
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
}

/**
 * Merge near-duplicate risk segments. A dense GPX track produces one risk
 * entry per ~20 m point, so the start line alone can yield dozens of rows.
 * Group consecutive entries (per race, within `gapKm`) and keep the worst one.
 */
function clusterRiskZones(
  entries: { raceId: string; segmentIndex: number; riskScore: number; jamProbability: number; peakDensity: number }[],
  races: { id: string; gpxPoints: GPXPoint[] }[],
  gapKm = 0.4
): ClusteredRisk[] {
  const byRace = new Map<string, ClusteredRisk[]>()
  for (const e of entries) {
    const race = races.find((r) => r.id === e.raceId)
    const dist = race?.gpxPoints[e.segmentIndex]?.dist ?? 0
    if (!byRace.has(e.raceId)) byRace.set(e.raceId, [])
    byRace.get(e.raceId)!.push({ ...e, dist })
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
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: string
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
    </div>
  )
}

export function ResultsView({
  event,
  simulation,
  result,
  races,
  runnerProfiles,
}: ResultsViewProps) {
  const [visibleRaces, setVisibleRaces] = useState<Set<string>>(
    () => new Set(races.map((r) => r.id))
  )
  const [highlightedSegment, setHighlightedSegment] = useState<{
    raceId: string
    segmentIndex: number
  } | null>(null)

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
  const timestamps = useMemo(() => result?.globalTimestamps ?? [], [result])
  const runnersData = useMemo(() => result?.runnersData ?? [], [result])
  const maxIndex = Math.max(0, timestamps.length - 1)
  const [timeIndex, setTimeIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1) // playback multiplier
  // Map layers ("Couches actives")
  const [layers, setLayers] = useState({
    runners: true,
    zones: true,
    shared: true,
    density: true,
    heat: false,
    logistique: true,
  })
  const setLayer = useCallback((name: keyof typeof layers, on: boolean) => {
    setLayers((s) => ({ ...s, [name]: on }))
  }, [])
  // Hovered point on the elevation profile -> marker following the trace on the map
  const [hoverPoint, setHoverPoint] = useState<[number, number] | null>(null)
  const playRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // --- Interactive logistics placement (persisted to localStorage) ---
  const [placedLogistics, setPlacedLogistics] = useState<PlacedLogi[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(logiStorageKey(simulation.id))
      return raw ? (JSON.parse(raw) as PlacedLogi[]) : []
    } catch {
      return []
    }
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

  // First finisher: earliest timestamp where any runner reaches the finish
  const firstFinishSeconds = useMemo(() => {
    let best = Infinity
    for (const r of runnersData) {
      for (let t = 0; t < r.positions.length; t++) {
        if (r.positions[t] >= 1) {
          if (timestamps[t] < best) best = timestamps[t]
          break
        }
      }
    }
    return isFinite(best) ? best : null
  }, [runnersData, timestamps])

  // DNF estimate: Σ runners(profile) × abandonRate, averaged over profiles
  const dnfEstimate = useMemo(() => {
    return Math.round(
      runnerProfiles.reduce(
        (sum, p) => sum + simulation.totalRunners * (p.percentage / 100) * p.abandonRate,
        0
      )
    )
  }, [runnerProfiles, simulation.totalRunners])

  // Peak runners on course across the whole timeline
  const peakOnCourse = useMemo(() => {
    if (timestamps.length === 0) return 0
    let peak = 0
    for (let t = 0; t < timestamps.length; t++) {
      let n = 0
      for (const r of runnersData) {
        const p = r.positions[t] ?? 0
        if (p > 0 && p < 1) n++
      }
      if (n > peak) peak = n
    }
    return peak
  }, [runnersData, timestamps])

  const maxPeakDensity = useMemo(
    () => Math.max(1, ...riskMap.map((e) => e.peakDensity)),
    [riskMap]
  )

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
        '--color-bg': '#14110f',
        '--color-bg-1': '#1a1714',
        '--color-bg-2': '#222019',
        '--color-line': '#2a2824',
        '--color-ink': '#f5f4f0',
        '--color-ink-2': '#c8c4bc',
        '--color-ink-3': '#8a8680',
        '--color-ink-4': '#555250',
        '--color-lime': '#7CB518',
        '--color-danger': '#DC2626',
        '--color-warning': '#D97706',
        '--color-safe': '#16A34A',
      } as React.CSSProperties}
    >
      {/* Topbar */}
      <header
        className="flex items-center gap-4 px-5 border-b shrink-0"
        style={{
          height: 52,
          background: 'var(--color-bg-1)',
          borderColor: 'var(--color-line)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 mr-2">
          <ZapIcon size={16} style={{ color: 'var(--color-lime)' }} />
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: 'var(--color-ink)' }}
          >
            TrailSim
          </span>
        </div>

        <span
          className="text-sm font-medium truncate max-w-[220px]"
          style={{ color: 'var(--color-ink-2)' }}
        >
          {event.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link href={`/events/${event.id}/setup`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeftIcon size={13} />
              Configuration
            </Button>
          </Link>

          <Link href={`/events/${event.id}/report/${simulation.id}`}>
            <Button variant="primary" size="sm" className="gap-1.5">
              <FileTextIcon size={13} />
              Export PDF
            </Button>
          </Link>
        </div>
      </header>

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
              runnersData={runnersData}
              timeIndex={timeIndex}
              showRunners={layers.runners}
              showZones={layers.zones}
              showShared={layers.shared}
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
              <LayerSwitch label="Densité live" on={layers.density} onClick={() => setLayer('density', !layers.density)} />
              <LayerSwitch label="Heatmap" on={layers.heat} onClick={() => setLayer('heat', !layers.heat)} />
              <LayerSwitch label="Logistique" on={layers.logistique} onClick={() => setLayer('logistique', !layers.logistique)} />
            </div>
          </Section>

          {/* STATISTIQUES section */}
          <Section icon={<BarChart3Icon size={12} />} label="Statistiques simulation">
            <div className="p-3 grid grid-cols-2 gap-2">
              <StatTile
                icon={<FlagIcon size={12} />}
                label="Premier arrivé"
                value={firstFinishSeconds != null ? formatTimeHHMM(firstFinishSeconds) : '—'}
              />
              <StatTile
                icon={<TrendingDownIcon size={12} />}
                label="DNF estimés"
                value={String(dnfEstimate)}
                tone="warning"
              />
              <StatTile
                icon={<UsersIcon size={12} />}
                label="Pic en piste"
                value={String(peakOnCourse)}
              />
              <StatTile
                icon={<AlertTriangleIcon size={12} />}
                label="Zones détectées"
                value={String(riskMap.length)}
              />
            </div>
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
                        {entry.peakDensity.toFixed(0)} crs
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                        Bouchon {Math.round(entry.jamProbability * 100)}%
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

          {/* COLLISIONS section */}
          <Section
            icon={<ZapIcon size={12} />}
            label="Collisions"
            count={collisionWindows.length}
          >
            <div className="p-3 flex flex-col gap-1">
              {collisionWindows.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune fenêtre de collision détectée.
                </p>
              )}
              {collisionWindows.map((cw, i) => {
                const raceNames = cw.raceIds
                  .map((rid) => races.find((r) => r.id === rid)?.name ?? rid)
                  .join(' × ')
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1 px-3 py-2.5 rounded-lg"
                    style={{
                      background: 'var(--color-bg-2)',
                      border: '1px solid var(--color-line)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink-2)' }}>
                        {raceNames}
                      </span>
                      <span
                        className="text-xs font-mono ml-2 shrink-0"
                        style={{
                          color: cw.peak >= 0.8 ? 'var(--color-danger)' : 'var(--color-warning)',
                        }}
                      >
                        pic {Math.round(cw.peak * 100)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-3)' }}>
                        {formatTimeHHMM(cw.tStart)}
                      </span>
                      <span style={{ color: 'var(--color-ink-4)' }}>→</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-3)' }}>
                        {formatTimeHHMM(cw.tEnd)}
                      </span>
                      <span
                        className="ml-auto text-xs font-mono"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        seg {cw.segmentIndex}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </Section>

          {/* PROFILS section */}
          <Section icon={<UsersIcon size={12} />} label="Profils" count={runnerProfiles.length} defaultOpen={false}>
            <div className="p-3 flex flex-col gap-2">
              {runnerProfiles.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucun profil configuré.
                </p>
              )}
              {runnerProfiles.map((profile) => (
                <div key={profile.id} className="flex flex-col gap-1.5 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: profile.color }}
                    />
                    <span
                      className="flex-1 text-sm truncate"
                      style={{ color: 'var(--color-ink-2)' }}
                    >
                      {profile.label}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--color-ink-3)' }}
                    >
                      {profile.percentage.toFixed(0)}%
                    </span>
                  </div>
                  {/* Percentage bar */}
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-bg-2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(profile.percentage, 100)}%`,
                        background: profile.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
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
