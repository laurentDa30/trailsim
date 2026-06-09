// Pure (server-safe) computations shared by the results view and the PDF report.
// No React, no DOM — just numbers derived from a CompressedSimulationResult.

import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'

export interface RaceLite {
  id: string
  name: string
  color: string
  gpxPoints: GPXPoint[]
}

export interface ClusteredZone {
  raceId: string
  segmentIndex: number
  riskScore: number
  jamProbability: number
  peakDensity: number
  dist: number
  kind: 'bouchon' | 'affluence'
}

/**
 * Merge near-duplicate risk segments. A dense GPX track yields one risk entry
 * per ~20 m, so a single hotspot can produce dozens of rows. Group consecutive
 * entries (per race, within `gapKm`) and keep the worst one.
 */
export function clusterRiskZones(
  entries: CompressedSimulationResult['riskMap'],
  races: RaceLite[],
  gapKm = 0.4
): ClusteredZone[] {
  const byRace = new Map<string, ClusteredZone[]>()
  for (const e of entries) {
    const race = races.find((r) => r.id === e.raceId)
    const dist = race?.gpxPoints[e.segmentIndex]?.dist ?? 0
    if (!byRace.has(e.raceId)) byRace.set(e.raceId, [])
    byRace.get(e.raceId)!.push({
      raceId: e.raceId,
      segmentIndex: e.segmentIndex,
      riskScore: e.riskScore,
      jamProbability: e.jamProbability,
      peakDensity: e.peakDensity,
      dist,
      kind: e.kind ?? 'affluence',
    })
  }

  const out: ClusteredZone[] = []
  for (const list of byRace.values()) {
    list.sort((a, b) => a.dist - b.dist)
    let cluster: ClusteredZone[] = []
    const flush = () => {
      if (cluster.length === 0) return
      const best = cluster.reduce((m, c) => (c.riskScore > m.riskScore ? c : m), cluster[0])
      out.push({
        ...best,
        peakDensity: Math.max(...cluster.map((c) => c.peakDensity)),
        jamProbability: Math.max(...cluster.map((c) => c.jamProbability)),
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

export interface PerRaceStat {
  id: string
  name: string
  color: string
  total: number
  firstDuration: number | null // winner running time (s), departure excluded
  departSec: number | null
  finishSec: number | null
  dnf: number
  dnfRate: number
  maxLocal: number // peak runners / 150 m
  zones: number
}

const BIN_KM = 0.15

export function computePerRaceStats(
  result: CompressedSimulationResult,
  races: RaceLite[],
  clustered: ClusteredZone[]
): PerRaceStat[] {
  const ts = result.globalTimestamps
  return races.map((race) => {
    const rRunners = result.runnersData.filter((r) => r.raceId === race.id)
    const total = rRunners.length
    let firstSec = Infinity
    let departSec = Infinity
    let dnf = 0
    for (const r of rRunners) {
      let maxPos = 0
      let moved = false
      for (let t = 0; t < r.positions.length; t++) {
        const p = r.positions[t]
        if (p > maxPos) maxPos = p
        if (!moved && p > 0) {
          moved = true
          const s = ts[t]
          if (s != null && s < departSec) departSec = s
        }
        if (p >= 1) {
          const s = ts[t]
          if (s != null && s < firstSec) firstSec = s
          break
        }
      }
      if (maxPos < 0.999) dnf++
    }

    // peak runners within a 150 m bin at any single timestamp
    const totalKm =
      race.gpxPoints.length > 0 ? race.gpxPoints[race.gpxPoints.length - 1].dist : 0
    let maxLocal = 0
    if (totalKm > 0) {
      for (let t = 0; t < ts.length; t++) {
        const binCounts = new Map<number, number>()
        for (const r of rRunners) {
          const p = r.positions[t] ?? 0
          if (p <= 0 || p >= 1) continue
          const bin = Math.floor((p * totalKm) / BIN_KM)
          binCounts.set(bin, (binCounts.get(bin) ?? 0) + 1)
        }
        for (const c of binCounts.values()) if (c > maxLocal) maxLocal = c
      }
    }

    const zones = clustered.filter((e) => e.raceId === race.id).length
    return {
      id: race.id,
      name: race.name,
      color: race.color,
      total,
      firstDuration: isFinite(firstSec)
        ? firstSec - (isFinite(departSec) ? departSec : 0)
        : null,
      departSec: isFinite(departSec) ? departSec : null,
      finishSec: isFinite(firstSec) ? firstSec : null,
      dnf,
      dnfRate: total > 0 ? dnf / total : 0,
      maxLocal,
      zones,
    }
  })
}

export interface ClusteredCollision {
  raceIds: string[]
  segmentIndex: number
  tStart: number
  tEnd: number
  peak: number
  dist: number
}

/**
 * Merge adjacent collision windows of the SAME race-pair into one event. The
 * engine emits one window per 150 m bin, so a single catch-up on a shared
 * section produces dozens of near-identical rows (km 2.5, 2.7, 2.8 …). Group
 * by race-pair, then by distance proximity, keeping the union time-span and the
 * peak overlap — so the report and recommendations show events, not bins.
 */
export function clusterCollisionWindows(
  windows: CompressedSimulationResult['collisionWindows'],
  races: RaceLite[],
  gapKm = 0.6
): ClusteredCollision[] {
  const distOf = (raceId: string, seg: number) =>
    races.find((r) => r.id === raceId)?.gpxPoints[seg]?.dist ?? 0

  // group by unordered race-pair
  const byPair = new Map<string, (ClusteredCollision & { _dist: number })[]>()
  for (const w of windows) {
    const key = [...w.raceIds].sort().join('|')
    const dist = distOf(w.raceIds[0], w.segmentIndex)
    if (!byPair.has(key)) byPair.set(key, [])
    byPair.get(key)!.push({ ...w, dist, _dist: dist })
  }

  const out: ClusteredCollision[] = []
  for (const list of byPair.values()) {
    list.sort((a, b) => a._dist - b._dist)
    let cluster: typeof list = []
    const flush = () => {
      if (cluster.length === 0) return
      const best = cluster.reduce((m, c) => (c.peak > m.peak ? c : m), cluster[0])
      out.push({
        raceIds: best.raceIds,
        segmentIndex: best.segmentIndex,
        dist: best.dist,
        tStart: Math.min(...cluster.map((c) => c.tStart)),
        tEnd: Math.max(...cluster.map((c) => c.tEnd)),
        peak: Math.max(...cluster.map((c) => c.peak)),
      })
      cluster = []
    }
    for (const w of list) {
      if (cluster.length > 0 && w._dist - cluster[cluster.length - 1]._dist > gapKm) flush()
      cluster.push(w)
    }
    flush()
  }
  // strongest first
  return out.sort((a, b) => b.peak - a.peak)
}

export type Priority = 'haute' | 'moyenne' | 'faible'

export interface Recommendation {
  priority: Priority
  category: 'Bouchon' | 'Affluence' | 'Croisement' | 'Départ' | 'Abandons'
  where: string // "Trail 20km · km 4.2"
  action: string
}

const PRIO_RANK: Record<Priority, number> = { haute: 0, moyenne: 1, faible: 2 }

/**
 * Derive actionable, data-driven recommendations from the simulation: where to
 * widen, add a marshal, stagger a start, or check cut-off times.
 */
export function computeRecommendations(
  result: CompressedSimulationResult,
  races: RaceLite[],
  clustered: ClusteredZone[],
  perRace: PerRaceStat[]
): Recommendation[] {
  const recs: Recommendation[] = []
  const raceName = (id: string) => races.find((r) => r.id === id)?.name ?? 'Course'

  // 1) Bouchons & affluence per zone
  for (const z of clustered) {
    const where = `${raceName(z.raceId)} · km ${z.dist.toFixed(1)}`
    const nearStart = z.dist <= 1.5
    if (z.kind === 'bouchon') {
      const hard = z.jamProbability >= 0.5 || z.peakDensity >= 25
      if (nearStart) {
        recs.push({
          priority: hard ? 'haute' : 'moyenne',
          category: 'Départ',
          where,
          action: `Forte densité dès le départ (${Math.round(z.peakDensity)} coureurs/150 m, bloqué ${Math.round(
            z.jamProbability * 100
          )}% du temps). Prévoir un départ en sas ou une vague supplémentaire pour étaler le flux.`,
        })
      } else {
        recs.push({
          priority: hard ? 'haute' : 'moyenne',
          category: 'Bouchon',
          where,
          action: `Goulot d'étranglement (${Math.round(z.peakDensity)} coureurs/150 m, bloqué ${Math.round(
            z.jamProbability * 100
          )}% du temps). Élargir le passage si possible et y poster un signaleur pour fluidifier.`,
        })
      }
    } else if (z.peakDensity >= 18) {
      recs.push({
        priority: z.peakDensity >= 30 ? 'moyenne' : 'faible',
        category: 'Affluence',
        where,
        action: `Forte concentration (${Math.round(
          z.peakDensity
        )} coureurs/150 m) mais fluide. Renforcer la signalisation/l'encadrement, dimensionner un éventuel ravito proche.`,
      })
    }
  }

  // 2) Inter-race meetings → suggest staggering a start (clustered: one reco per event)
  for (const cw of clusterCollisionWindows(result.collisionWindows, races)) {
    if (cw.peak < 18) continue
    const dist = cw.dist
    const names = cw.raceIds.map(raceName).join(' ↔ ')
    // suggest a shift roughly half the overlap window, rounded to 5 min
    const overlapMin = (cw.tEnd - cw.tStart) / 60
    const shift = Math.max(5, Math.round(overlapMin / 2 / 5) * 5)
    recs.push({
      priority: cw.peak >= 25 ? 'haute' : 'moyenne',
      category: 'Croisement',
      where: dist != null ? `${names} · km ${dist.toFixed(1)}` : names,
      action: `Croisement de pelotons (jusqu'à ${Math.round(
        cw.peak
      )} coureurs ensemble). Décaler le départ d'une des vagues d'environ ${shift} min désynchroniserait le croisement.`,
    })
  }

  // 3) High DNF per race
  for (const s of perRace) {
    if (s.total > 0 && s.dnfRate >= 0.15) {
      recs.push({
        priority: s.dnfRate >= 0.25 ? 'moyenne' : 'faible',
        category: 'Abandons',
        where: s.name,
        action: `Taux d'abandon estimé élevé (${Math.round(
          s.dnfRate * 100
        )}%). Vérifier les barrières horaires et le placement des ravitos sur cette course.`,
      })
    }
  }

  recs.sort((a, b) => PRIO_RANK[a.priority] - PRIO_RANK[b.priority])
  return recs.slice(0, 12)
}

// ───────────────────────────────────────────────────────────────────────────
// Organisation helpers — cut-offs, poste windows, finish flow.
// All read the LAST-RUN trajectory (runnersData), i.e. a single representative
// scenario (same basis as the timelapse / affluence), not an N-run average.
// ───────────────────────────────────────────────────────────────────────────

/** Clock time (s from T0) at which a runner first reaches fraction `p` of its race. */
function crossingSec(positions: number[], ts: number[], p: number): number | null {
  for (let t = 0; t < positions.length; t++) {
    if ((positions[t] ?? 0) >= p) return ts[t] ?? null
  }
  return null
}

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))
  return sorted[i]
}

export interface PassageStats {
  firstSec: number | null
  p50Sec: number | null
  p90Sec: number | null
  p95Sec: number | null
  lastSec: number | null
  total: number // runners who reached this point
  field: number // runners in the race
}

/**
 * FEATURE 1 — cut-off helper. Times at which the field crosses a given km of a
 * race (clock time from T0): 1st, median, 90 %, 95 %, last. An organiser reads
 * "to drop ≤ 10 %, set the barrier at the 90 % time".
 */
export function computePassageStats(
  result: CompressedSimulationResult,
  race: RaceLite,
  km: number
): PassageStats {
  const ts = result.globalTimestamps
  const total = race.gpxPoints.length > 0 ? race.gpxPoints[race.gpxPoints.length - 1].dist : 0
  const p = total > 0 ? Math.min(1, km / total) : 0
  const rr = result.runnersData.filter((r) => r.raceId === race.id)
  const times: number[] = []
  for (const r of rr) {
    const s = crossingSec(r.positions, ts, p)
    if (s != null) times.push(s)
  }
  times.sort((a, b) => a - b)
  return {
    firstSec: times[0] ?? null,
    p50Sec: quantile(times, 0.5),
    p90Sec: quantile(times, 0.9),
    p95Sec: quantile(times, 0.95),
    lastSec: times[times.length - 1] ?? null,
    total: times.length,
    field: rr.length,
  }
}

export interface PassageBin {
  km: number
  firstSec: number
  lastSec: number
  count: number
}

/**
 * FEATURE 2 — per-km-bin passage window for a race (single pass). For each
 * 150 m bin: first arrival and last departure (clock time) and how many runners
 * passed. Used to give each logistics poste / ravito its "active from→to"
 * staffing window.
 */
export function computePassageByKmBin(
  result: CompressedSimulationResult,
  race: RaceLite,
  binKm = 0.15
): PassageBin[] {
  const ts = result.globalTimestamps
  const total = race.gpxPoints.length > 0 ? race.gpxPoints[race.gpxPoints.length - 1].dist : 0
  if (total <= 0) return []
  const nBins = Math.max(1, Math.ceil(total / binKm))
  const first = new Array<number>(nBins).fill(Infinity)
  const last = new Array<number>(nBins).fill(-Infinity)
  const count = new Array<number>(nBins).fill(0)
  const rr = result.runnersData.filter((r) => r.raceId === race.id)
  for (const r of rr) {
    let prevBin = -1
    for (let t = 0; t < r.positions.length; t++) {
      const pos = r.positions[t] ?? 0
      if (pos <= 0) continue
      const km = pos * total
      const bin = Math.min(nBins - 1, Math.floor(km / binKm))
      const sec = ts[t]
      if (sec == null) continue
      if (sec < first[bin]) first[bin] = sec
      if (sec > last[bin]) last[bin] = sec
      if (bin !== prevBin) {
        count[bin]++ // count a runner once per bin entered
        prevBin = bin
      }
    }
  }
  const out: PassageBin[] = []
  for (let b = 0; b < nBins; b++) {
    if (count[b] > 0 && isFinite(first[b])) {
      out.push({ km: (b + 0.5) * binKm, firstSec: first[b], lastSec: last[b], count: count[b] })
    }
  }
  return out
}

/** Nearest passage bin to a given km (for mapping an arbitrary poste position). */
export function passageAtKm(bins: PassageBin[], km: number): PassageBin | null {
  let best: PassageBin | null = null
  let bestD = Infinity
  for (const b of bins) {
    const d = Math.abs(b.km - km)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

export interface FinishFlowBin {
  tStart: number
  tEnd: number
  count: number
}
export interface RaceFinishFlow {
  raceId: string
  name: string
  color: string
  total: number
  firstSec: number | null
  medianSec: number | null
  lastSec: number | null
  bins: number[] // counts aligned to the shared bin grid
}

/**
 * FEATURE 5 — finish-line arrival flow. Histogram of finishers per time bin
 * (default 10 min) per race + combined, on a shared grid, to size the finish
 * area / chrono / final ravito and spot two races arriving together.
 */
export function computeFinishFlow(
  result: CompressedSimulationResult,
  races: RaceLite[],
  binSec = 600
): {
  perRace: RaceFinishFlow[]
  combined: number[]
  grid: FinishFlowBin[]
  binSec: number
  peakCombined: number
} {
  const ts = result.globalTimestamps
  // collect finish times per race
  const finishByRace = new Map<string, number[]>()
  let maxFinish = 0
  for (const race of races) {
    const rr = result.runnersData.filter((r) => r.raceId === race.id)
    const finishes: number[] = []
    for (const r of rr) {
      const s = crossingSec(r.positions, ts, 1)
      if (s != null) {
        finishes.push(s)
        if (s > maxFinish) maxFinish = s
      }
    }
    finishes.sort((a, b) => a - b)
    finishByRace.set(race.id, finishes)
  }
  const nBins = Math.max(1, Math.ceil((maxFinish + 1) / binSec))
  const grid: FinishFlowBin[] = []
  for (let b = 0; b < nBins; b++) grid.push({ tStart: b * binSec, tEnd: (b + 1) * binSec, count: 0 })
  const combined = new Array<number>(nBins).fill(0)

  const perRace: RaceFinishFlow[] = races.map((race) => {
    const finishes = finishByRace.get(race.id) ?? []
    const bins = new Array<number>(nBins).fill(0)
    for (const s of finishes) {
      const b = Math.min(nBins - 1, Math.floor(s / binSec))
      bins[b]++
      combined[b]++
    }
    return {
      raceId: race.id,
      name: race.name,
      color: race.color,
      total: finishes.length,
      firstSec: finishes[0] ?? null,
      medianSec: quantile(finishes, 0.5),
      lastSec: finishes[finishes.length - 1] ?? null,
      bins,
    }
  })

  return { perRace, combined, grid, binSec, peakCombined: Math.max(1, ...combined) }
}
