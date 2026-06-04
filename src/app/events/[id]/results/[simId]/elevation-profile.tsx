'use client'

import { useMemo } from 'react'
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

/**
 * Multi-race altimetry band. Each visible race is plotted as an area on a
 * shared distance/altitude scale; risk zones are marked along the baseline.
 */
export function ElevationProfile({
  races,
  riskMap,
  visibleRaces,
  height = 178,
}: ElevationProfileProps) {
  const W = 1000
  const H = 100
  const padTop = 8
  const padBottom = 16

  const { paths, minAlt, maxAlt, maxDist, riskMarks } = useMemo(() => {
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
        return { x: xOf(pt.dist), score: e.riskScore, dist: pt.dist }
      })
      .filter((m): m is { x: number; score: number; dist: number } => m !== null)

    return { paths: built, minAlt: minA, maxAlt: maxA, maxDist: maxD, riskMarks: marks }
  }, [races, visibleRaces, riskMap])

  function riskColor(score: number) {
    if (score >= 0.8) return 'var(--color-danger)'
    if (score >= 0.5) return 'var(--color-warning)'
    return 'var(--color-safe)'
  }

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
      </div>

      {/* Altitude axis labels */}
      <div
        className="absolute right-3 top-6 text-[10px] font-mono"
        style={{ color: 'var(--color-ink-4)' }}
      >
        {Math.round(maxAlt)} m
      </div>
      <div
        className="absolute right-3 text-[10px] font-mono"
        style={{ color: 'var(--color-ink-4)', bottom: 22 }}
      >
        {Math.round(minAlt)} m
      </div>
      <div
        className="absolute left-4 text-[10px] font-mono"
        style={{ color: 'var(--color-ink-4)', bottom: 4 }}
      >
        0 km
      </div>
      <div
        className="absolute right-3 text-[10px] font-mono"
        style={{ color: 'var(--color-ink-4)', bottom: 4 }}
      >
        {maxDist.toFixed(1)} km
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="absolute inset-x-0"
        style={{ top: 24, height: height - 44, width: '100%' }}
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
      </svg>
    </div>
  )
}

export default ElevationProfile
