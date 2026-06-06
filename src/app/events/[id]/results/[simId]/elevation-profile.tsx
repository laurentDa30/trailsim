'use client'

import { useMemo, useRef, useState } from 'react'
import type { GPXPoint, RiskMapEntry } from '@/engine/types'
import { slopeColor, SLOPE_STOPS } from '@/lib/slope'

interface ElevationProfileProps {
  races: {
    id: string
    name: string
    color: string
    gpxPoints: GPXPoint[]
  }[]
  riskMap: RiskMapEntry[]
  visibleRaces: Set<string>
  height?: number
  /** Leader distance (km) per race at the current time → progress cursor. */
  cursorByRace?: Record<string, number>
  /** Called with a [lat,lng] while hovering (null on leave). */
  onHover?: (point: [number, number] | null) => void
}

const MAX_PTS = 320

function sample(points: GPXPoint[]): GPXPoint[] {
  if (points.length <= MAX_PTS) return points
  const step = Math.ceil(points.length / MAX_PTS)
  const out: GPXPoint[] = []
  for (let i = 0; i < points.length; i += step) out.push(points[i])
  if (out[out.length - 1] !== points[points.length - 1]) out.push(points[points.length - 1])
  return out
}

/** Find the [lat,lng] at a given cumulative distance (km) along a track. */
function latLngAtDist(points: GPXPoint[], dist: number): [number, number] | null {
  if (points.length === 0) return null
  if (dist <= points[0].dist) return [points[0].lat, points[0].lng]
  const last = points[points.length - 1]
  if (dist >= last.dist) return [last.lat, last.lng]
  for (let i = 1; i < points.length; i++) {
    if (points[i].dist >= dist) {
      const a = points[i - 1]
      const b = points[i]
      const span = b.dist - a.dist
      const t = span > 0 ? (dist - a.dist) / span : 0
      return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]
    }
  }
  return [last.lat, last.lng]
}

/**
 * Per-course altimetry band. Each course has its own tab (no overlaid traces),
 * with a hover cursor reported back to the map and a leader-progress cursor.
 */
export function ElevationProfile({
  races,
  riskMap,
  visibleRaces,
  height = 178,
  cursorByRace,
  onHover,
}: ElevationProfileProps) {
  const W = 1000
  const H = 100
  const padTop = 8
  const padBottom = 16

  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const lastHoverRef = useRef<number>(0)

  const visible = useMemo(
    () => races.filter((r) => visibleRaces.has(r.id) && r.gpxPoints.length > 1),
    [races, visibleRaces]
  )

  // The user's picked tab; falls back to the first visible course if the
  // selection is hidden or unset (derived during render, no effect needed).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const activeRace = visible.find((r) => r.id === selectedId) ?? visible[0] ?? null

  const { line, segs, minAlt, maxAlt, maxDist, riskMarks } = useMemo(() => {
    if (!activeRace) {
      return {
        line: '',
        segs: [] as { points: string; color: string }[],
        minAlt: 0,
        maxAlt: 1,
        maxDist: 1,
        riskMarks: [] as { x: number; score: number }[],
      }
    }
    const pts = activeRace.gpxPoints
    let minA = Infinity
    let maxA = -Infinity
    for (const p of pts) {
      if (p.alt < minA) minA = p.alt
      if (p.alt > maxA) maxA = p.alt
    }
    if (!isFinite(minA)) {
      minA = 0
      maxA = 1
    }
    if (maxA === minA) maxA = minA + 1
    const maxD = pts[pts.length - 1].dist || 1

    const xOf = (dist: number) => (dist / maxD) * W
    const yOf = (alt: number) =>
      padTop + (1 - (alt - minA) / (maxA - minA)) * (H - padTop - padBottom)

    const sampled = sample(pts)
    const ln = sampled.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.alt).toFixed(1)}`).join(' ')

    // Steepness-coloured fill: one filled quad per sample segment
    const segs = sampled.slice(0, -1).map((p, i) => {
      const q = sampled[i + 1]
      const x1 = xOf(p.dist)
      const x2 = xOf(q.dist)
      const y1 = yOf(p.alt)
      const y2 = yOf(q.alt)
      const base = H - padBottom
      return {
        points: `${x1.toFixed(1)},${base.toFixed(1)} ${x1.toFixed(1)},${y1.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)} ${x2.toFixed(1)},${base.toFixed(1)}`,
        color: slopeColor(p.slope),
      }
    })

    const marks = riskMap
      .filter((e) => e.raceId === activeRace.id)
      .map((e) => {
        const pt = activeRace.gpxPoints[e.segmentIndex]
        if (!pt) return null
        return { x: xOf(pt.dist), score: e.riskScore }
      })
      .filter((m): m is { x: number; score: number } => m !== null)

    return { line: ln, segs, minAlt: minA, maxAlt: maxA, maxDist: maxD, riskMarks: marks }
  }, [activeRace, riskMap])

  function riskColor(score: number) {
    if (score >= 0.8) return 'var(--color-danger)'
    if (score >= 0.5) return 'var(--color-warning)'
    return 'var(--color-safe)'
  }

  function handleMove(e: React.MouseEvent) {
    if (!activeRace) return
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverX(frac * W)
    const now = Date.now()
    if (now - lastHoverRef.current < 33) return
    lastHoverRef.current = now
    onHover?.(latLngAtDist(activeRace.gpxPoints, frac * maxDist))
  }

  function handleLeave() {
    setHoverX(null)
    onHover?.(null)
  }

  const cursorDist = activeRace ? cursorByRace?.[activeRace.id] ?? 0 : 0
  const cursorX = cursorDist > 0 ? Math.min(W, (cursorDist / maxDist) * W) : null
  const hoverDistKm = hoverX != null ? (hoverX / W) * maxDist : null
  const activeColor = activeRace?.color ?? 'var(--color-lime)'

  return (
    <div
      className="shrink-0 border-t relative flex flex-col"
      style={{ height, background: 'var(--color-bg-1)', borderColor: 'var(--color-line)' }}
    >
      {/* Tabs — one per course */}
      <div className="flex items-center gap-1 px-3 pt-1.5 shrink-0">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest mr-1"
          style={{ color: 'var(--color-ink-4)' }}
        >
          Profil
        </span>
        {visible.map((r) => {
          const on = activeRace?.id === r.id
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] transition-colors"
              style={{
                background: on ? 'var(--color-bg-2)' : 'transparent',
                border: '1px solid',
                borderColor: on ? r.color : 'transparent',
                color: on ? 'var(--color-ink)' : 'var(--color-ink-3)',
              }}
            >
              <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
              {r.name}
            </button>
          )
        })}
        {/* Steepness legend */}
        <span className="ml-auto flex items-center gap-1.5">
          {SLOPE_STOPS.map((s) => (
            <span key={s.label} className="flex items-center gap-0.5" title={s.label}>
              <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
            </span>
          ))}
          <span className="text-[9px]" style={{ color: 'var(--color-ink-4)' }}>
            plat → mur
          </span>
        </span>
        {hoverDistKm != null && (
          <span className="text-[10px] font-mono" style={{ color: activeColor }}>
            km {hoverDistKm.toFixed(1)}
          </span>
        )}
      </div>

      {/* Axis labels */}
      <div className="absolute right-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', top: 26 }}>
        {Math.round(maxAlt)} m
      </div>
      <div className="absolute right-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 20 }}>
        {Math.round(minAlt)} m
      </div>
      <div className="absolute left-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 4 }}>
        0 km
      </div>
      <div className="absolute right-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 4 }}>
        {maxDist.toFixed(1)} km
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="cursor-crosshair flex-1 w-full"
        style={{ minHeight: 0 }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {activeRace && (
          <>
            {segs.map((s, i) => (
              <polygon key={i} points={s.points} fill={s.color} opacity={0.5} stroke="none" />
            ))}
            <polyline points={line} fill="none" stroke={activeColor} strokeWidth={1.5} opacity={0.95} />
          </>
        )}

        {riskMarks.map((m, i) => (
          <line
            key={i}
            x1={m.x}
            y1={padTop}
            x2={m.x}
            y2={H - padBottom}
            stroke={riskColor(m.score)}
            strokeWidth={1}
            opacity={0.4}
          />
        ))}

        {cursorX != null && (
          <line x1={cursorX} y1={0} x2={cursorX} y2={H} stroke="var(--color-lime)" strokeWidth={1.5} opacity={0.9} />
        )}
        {hoverX != null && (
          <line x1={hoverX} y1={0} x2={hoverX} y2={H} stroke="var(--color-ink)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
        )}
      </svg>
    </div>
  )
}

export default ElevationProfile
