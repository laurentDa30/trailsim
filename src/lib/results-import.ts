// Parse a real results file (chronométreur export) and derive a peloton
// calibration for one race. Pure module — runs client-side, no upload needed.
//
// Accepted inputs:
//  - HTML-table exports (most chronométreurs' ".xls" files are HTML tables)
//  - CSV / TSV (the finish-time column is auto-detected)
//  - pasted text, one finish time per line
// Times are recognised as h:mm:ss (also 1h31'36 variants); "+mm:ss" gaps
// (écart column) are ignored, rows without a time (DNF) are skipped.

import type { GPXPoint } from '@/engine/types'
import { getMinettiSlopeFactor } from '@/engine/physics'
import { DEFAULT_ARCHETYPES } from '@/lib/archetypes'

export interface ParsedResults {
  /** Finish times in seconds, ascending. */
  times: number[]
}

const PLAUSIBLE_MIN = 10 * 60 // 10 min
const PLAUSIBLE_MAX = 30 * 3600 // 30 h

/** First plausible finish-time token of a row (skips "+mm:ss" gap columns). */
function firstTimeToken(row: string): number | null {
  const re = /[+\-]?\b(\d{1,2})[:hH](\d{2})[:'](\d{2})\b/g
  for (const m of row.matchAll(re)) {
    if (m[0].startsWith('+') || m[0].startsWith('-')) continue
    const total = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])
    if (total >= PLAUSIBLE_MIN && total <= PLAUSIBLE_MAX) return total
  }
  return null
}

/** Fallback for short races exported as mm:ss (no hour part anywhere). */
function firstShortTimeToken(row: string): number | null {
  const re = /[+\-]?\b(\d{2,3}):(\d{2})\b/g
  for (const m of row.matchAll(re)) {
    if (m[0].startsWith('+') || m[0].startsWith('-')) continue
    const total = Number(m[1]) * 60 + Number(m[2])
    if (total >= PLAUSIBLE_MIN && total <= PLAUSIBLE_MAX) return total
  }
  return null
}

export function parseResultTimes(raw: string): ParsedResults {
  // HTML export → one logical row per <tr>; otherwise one per line.
  const isHtml = /<t[rd][\s>]/i.test(raw)
  const rows = isHtml
    ? (raw.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) ?? []).map((r) =>
        r.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ')
      )
    : raw.split(/\r?\n/)

  let times = rows
    .map(firstTimeToken)
    .filter((t): t is number => t != null)
  if (times.length === 0) {
    times = rows.map(firstShortTimeToken).filter((t): t is number => t != null)
  }
  times.sort((a, b) => a - b)
  return { times }
}

// ---------------------------------------------------------------------------
// Calibration: observed finish times → archetype distribution
// ---------------------------------------------------------------------------

export interface CalibrationProposal {
  n: number
  firstSec: number
  medianSec: number
  lastSec: number
  /** Engine slope+fatigue multiplier estimated for this course (0–1). */
  multiplier: number
  distanceKm: number
  /** Archetype id → percentage (sums to 100). */
  percentages: Record<string, number>
  /** Sanity check: median finish the engine should now produce (s). */
  predictedMedianSec: number
}

/**
 * Time-weighted speed multiplier the engine applies on this course: harmonic
 * mean over distance of (Tobler slope factor × fatigue decay), mirroring the
 * worker's smoothed slope and fatigue model (floors ignored — they only bind
 * at the extreme back). Used to convert observed race speeds into the flat
 * base speeds the archetype bands are defined in.
 */
function courseMultiplier(pts: GPXPoint[]): number {
  if (pts.length < 2) return 0.82
  const totalDist = pts[pts.length - 1].dist
  if (totalDist <= 0) return 0.82

  // Smoothed slope (±50 m), same as the simulation worker.
  const SMOOTH_KM = 0.05
  const smooth: number[] = new Array(pts.length).fill(0)
  for (let i = 0; i < pts.length; i++) {
    let b = i
    while (b > 0 && pts[i].dist - pts[b].dist < SMOOTH_KM) b--
    let f = i
    while (f < pts.length - 1 && pts[f].dist - pts[i].dist < SMOOTH_KM) f++
    const dd = (pts[f].dist - pts[b].dist) * 1000
    const s = dd > 0 ? ((pts[f].alt - pts[b].alt) / dd) * 100 : 0
    smooth[i] = Math.max(-40, Math.min(40, s))
  }

  let totalElevGain = 0
  for (let i = 1; i < pts.length; i++) {
    const d = pts[i].alt - pts[i - 1].alt
    if (d > 0) totalElevGain += d
  }

  let rel = 0 // Σ segLen / (slopeFactor × fatigueFactor) — relative time
  let elevDone = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const segLen = pts[i + 1].dist - pts[i].dist
    if (segLen <= 0) continue
    const dAlt = pts[i + 1].alt - pts[i].alt
    if (dAlt > 0) elevDone += dAlt
    const slopeF = getMinettiSlopeFactor(smooth[i])
    const distProg = pts[i].dist / totalDist
    const elevProg = totalElevGain > 0 ? elevDone / totalElevGain : 0
    const effort = distProg * 0.7 + elevProg * 0.3
    const fat = effort < 0.4 ? 1 : 1 - Math.pow(effort - 0.4, 1.5) * 0.6
    rel += segLen / (slopeF * fat)
  }
  if (rel <= 0) return 0.82
  return Math.max(0.5, Math.min(1.1, totalDist / rel))
}

/** Flat base speed (km/h) at quantile q of a fast→slow band mix. */
function baseAtQuantile(
  bands: { id: string; lo: number; hi: number; pct: number }[],
  q: number
): number {
  const target = q * 100
  let cum = 0
  for (const b of bands) {
    if (b.pct <= 0) continue
    if (target <= cum + b.pct) {
      const frac = (target - cum) / b.pct
      return b.hi - frac * (b.hi - b.lo)
    }
    cum += b.pct
  }
  const last = [...bands].reverse().find((b) => b.pct > 0)
  return last ? last.lo : 0
}

export function deriveCalibration(
  times: number[],
  distanceKm: number,
  gpxPoints?: GPXPoint[]
): CalibrationProposal | null {
  if (times.length < 5 || distanceKm <= 0) return null
  const m = gpxPoints && gpxPoints.length > 1 ? courseMultiplier(gpxPoints) : 0.82

  // Flat base speed each finisher implies, given this course's multiplier.
  const bases = times.map((t) => distanceKm / (t / 3600) / m)

  // Count finishers into the default speed bands (out of range → edge band).
  const bands = DEFAULT_ARCHETYPES.map((a) => ({
    id: a.id,
    lo: a.speedMin,
    hi: a.speedMax,
  }))
  const counts = new Array<number>(bands.length).fill(0)
  for (const base of bases) {
    let idx = bands.findIndex((b) => base >= b.lo && base <= b.hi)
    if (idx < 0) idx = base > bands[0].hi ? 0 : bands.length - 1
    counts[idx]++
  }

  // Largest-remainder rounding to 100 %.
  const exact = counts.map((c) => (c / times.length) * 100)
  const pct = exact.map((e) => Math.floor(e))
  let remaining = 100 - pct.reduce((s, p) => s + p, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) pct[order[k].i]++

  const percentages: Record<string, number> = {}
  bands.forEach((b, i) => {
    percentages[b.id] = pct[i]
  })

  const medianBase = baseAtQuantile(
    bands.map((b, i) => ({ ...b, pct: pct[i] })),
    0.5
  )
  const predictedMedianSec =
    medianBase > 0 ? (distanceKm / (medianBase * m)) * 3600 : 0

  return {
    n: times.length,
    firstSec: times[0],
    medianSec: times[Math.round((times.length - 1) / 2)],
    lastSec: times[times.length - 1],
    multiplier: m,
    distanceKm,
    percentages,
    predictedMedianSec,
  }
}

export function fmtDuration(s: number): string {
  const h = Math.floor(s / 3600)
  const mn = Math.round((s % 3600) / 60)
  return h > 0 ? `${h}h${String(mn).padStart(2, '0')}` : `${mn} min`
}
