'use client'

import { useMemo, useRef, useState } from 'react'
import type { GPXPoint, RiskMapEntry } from '@/engine/types'

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
  /** Leader distance (km) at the current time → vertical progress cursor. */
  cursorDist?: number
  /** Called with a [lat,lng] while hovering (null on leave). */
  onHover?: (point: [number, number] | null) => void
}

const MAX_PTS = 320

/** Decimate to at most MAX_PTS points, keeping altimetric shape. */
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
  // linear scan (tracks are pre-sized; fine for a hover handler)
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
 * Multi-race altimetry band with a progress cursor and a hover cursor that
 * reports the matching trace point back to the parent (shown on the map).
 */
export function ElevationProfile({
  races,
  riskMap,
  visibleRaces,
  height = 178,
  cursorDist,
  onHover,
}: ElevationProfileProps) {
  const W = 1000
  const H = 100
  const padTop = 8
  const padBottom = 16

  const svgRef = useRef<SVGSVGElement>(null)
  const [hoverX, setHoverX] = useState<number | null>(null)
  const lastHoverRef = useRef<number>(0)

  const { paths, minAlt, maxAlt, maxDist, riskMarks, hoverTrack } = useMemo(() => {
    const visible = races.filter((r) => visibleRaces.has(r.id) && r.gpxPoints.length > 1)
    let minA = Infinity
    let maxA = -Infinity
    let maxD = 0
    for (const r of visible) {
      for (const p of r.gpxPoints) {
        if (p.alt < minA) minA = p.alt
        if (p.alt > maxA) maxA = p.alt
      }
      const d = r.gpxPoints[r.gpxPoints.length - 1].dist
      if (d > maxD) maxD = d
    }
    if (!isFinite(minA)) {
      minA = 0
      maxA = 1
    }
    if (maxA === minA) maxA = minA + 1
    if (maxD === 0) maxD = 1

    const xOf = (dist: number) => (dist / maxD) * W
    const yOf = (alt: number) =>
      padTop + (1 - (alt - minA) / (maxA - minA)) * (H - padTop - padBottom)

    const built = visible.map((r) => {
      const pts = sample(r.gpxPoints)
      const line = pts.map((p) => `${xOf(p.dist).toFixed(1)},${yOf(p.alt).toFixed(1)}`).join(' ')
      const area =
        `${xOf(pts[0].dist).toFixed(1)},${(H - padBottom).toFixed(1)} ` +
        line +
        ` ${xOf(pts[pts.length - 1].dist).toFixed(1)},${(H - padBottom).toFixed(1)}`
      return { id: r.id, color: r.color, name: r.name, line, area }
    })

    const marks = riskMap
      .filter((e) => visibleRaces.has(e.raceId))
      .map((e) => {
        const race = races.find((rr) => rr.id === e.raceId)
        const pt = race?.gpxPoints[e.segmentIndex]
        if (!pt) return null
        return { x: xOf(pt.dist), score: e.riskScore }
      })
      .filter((m): m is { x: number; score: number } => m !== null)

    // Longest visible track drives the hover marker
    const longest = visible.reduce<GPXPoint[]>(
      (best, r) => (r.gpxPoints.length > best.length ? r.gpxPoints : best),
      [] as GPXPoint[]
    )

    return {
      paths: built,
      minAlt: minA,
      maxAlt: maxA,
      maxDist: maxD,
      riskMarks: marks,
      hoverTrack: longest,
    }
  }, [races, visibleRaces, riskMap])

  function riskColor(score: number) {
    if (score >= 0.8) return 'var(--color-danger)'
    if (score >= 0.5) return 'var(--color-warning)'
    return 'var(--color-safe)'
  }

  function handleMove(e: React.MouseEvent) {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    setHoverX(frac * W)
    // Throttle the parent/map update to ~30fps to avoid re-rendering all markers
    const now = Date.now()
    if (now - lastHoverRef.current < 33) return
    lastHoverRef.current = now
    onHover?.(latLngAtDist(hoverTrack, frac * maxDist))
  }

  function handleLeave() {
    setHoverX(null)
    onHover?.(null)
  }

  const cursorX =
    cursorDist != null && cursorDist > 0 ? Math.min(W, (cursorDist / maxDist) * W) : null
  const hoverDistKm = hoverX != null ? (hoverX / W) * maxDist : null

  return (
    <div
      className="shrink-0 border-t relative"
      style={{
        height,
        background: 'var(--color-bg-1)',
        borderColor: 'var(--color-line)',
      }}
    >
      <div className="absolute top-2 left-4 flex items-center gap-3 z-10">
        <span
          className="text-[10px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--color-ink-4)' }}
        >
          Profil altimétrique
        </span>
        {paths.map((p) => (
          <span key={p.id} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            <span className="text-[10px]" style={{ color: 'var(--color-ink-3)' }}>
              {p.name}
            </span>
          </span>
        ))}
        {hoverDistKm != null && (
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-lime)' }}>
            km {hoverDistKm.toFixed(1)}
          </span>
        )}
      </div>

      {/* Altitude / distance axis labels */}
      <div className="absolute right-3 top-6 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
        {Math.round(maxAlt)} m
      </div>
      <div className="absolute right-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 22 }}>
        {Math.round(minAlt)} m
      </div>
      <div className="absolute left-4 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 4 }}>
        0 km
      </div>
      <div className="absolute right-3 text-[10px] font-mono" style={{ color: 'var(--color-ink-4)', bottom: 4 }}>
        {maxDist.toFixed(1)} km
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-x-0 cursor-crosshair"
        style={{ top: 24, height: height - 44, width: '100%' }}
        onMouseMove={handleMove}
        onMouseLeave={handleLeave}
      >
        {paths.map((p) => (
          <g key={p.id}>
            <polygon points={p.area} fill={p.color} opacity={0.12} />
            <polyline points={p.line} fill="none" stroke={p.color} strokeWidth={1.5} opacity={0.9} />
          </g>
        ))}

        {/* Risk zone marks along baseline */}
        {riskMarks.map((m, i) => (
          <line
            key={i}
            x1={m.x}
            y1={padTop}
            x2={m.x}
            y2={H - padBottom}
            stroke={riskColor(m.score)}
            strokeWidth={1}
            opacity={0.35}
          />
        ))}

        {/* Progress cursor (leader) */}
        {cursorX != null && (
          <line
            x1={cursorX}
            y1={0}
            x2={cursorX}
            y2={H}
            stroke="var(--color-lime)"
            strokeWidth={1.5}
            opacity={0.9}
          />
        )}

        {/* Hover cursor */}
        {hoverX != null && (
          <line
            x1={hoverX}
            y1={0}
            x2={hoverX}
            y2={H}
            stroke="var(--color-ink)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.6}
          />
        )}
      </svg>
    </div>
  )
}

export default ElevationProfile
