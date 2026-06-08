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

  // 2) Inter-race meetings → suggest staggering a start
  for (const cw of result.collisionWindows) {
    if (cw.peak < 18) continue
    const r0 = races.find((r) => r.id === cw.raceIds[0])
    const dist = r0?.gpxPoints[cw.segmentIndex]?.dist
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
