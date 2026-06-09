/**
 * TrailSim Web Worker – Monte-Carlo trail race simulation engine.
 *
 * Receives a START message with a SimConfig, runs nRuns iterations,
 * posts PROGRESS updates, then posts the final CompressedSimulationResult.
 */

import type {
  CompressedSimulationResult,
  GPXPoint,
  RaceConfig,
  RiskMapEntry,
  RunnerState,
  SimConfig,
  WorkerMessage,
} from "./types"
import { computeSpeed, computeFatigueFactor } from "./physics"
import { computeWeather } from "./weather"
import { computeDensityFactor, computeSegmentCapacity } from "./bottleneck"
import { createRunnersFromProfiles } from "./runner-factory"

// ---------------------------------------------------------------------------
// Worker message handler
// ---------------------------------------------------------------------------

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  if (e.data.type === "START") {
    runSimulation(e.data.config).catch((err) => {
      self.postMessage({ type: "ERROR", message: String(err) } satisfies WorkerMessage)
    })
  }
}

// ---------------------------------------------------------------------------
// Main simulation entry point
// ---------------------------------------------------------------------------

async function runSimulation(config: SimConfig): Promise<void> {
  try {
    const { races, weather, stepSeconds, nRuns, simulationId } = config
    const JAM_RUNNERS = config.jamThreshold && config.jamThreshold > 0 ? config.jamThreshold : 10
    const AFFLUENCE_THRESHOLD =
      config.affluenceThreshold && config.affluenceThreshold > 0 ? config.affluenceThreshold : 15

    if (races.length === 0) {
      self.postMessage({ type: "ERROR", message: "No races configured" } satisfies WorkerMessage)
      return
    }

    // Density is binned by fixed distance (not per GPX point): a dense track
    // has a point every ~20 m, so per-point counts are almost always ~1 runner.
    // 150 m bins reflect actual crowding / groups.
    const DENSITY_BIN_M = 150
    const DENSITY_BIN_KM = DENSITY_BIN_M / 1000

    // Pre-compute race metadata
    const raceMeta = races.map((race) => {
      const pts = race.gpxPoints
      const totalDist = pts.length > 0 ? pts[pts.length - 1].dist : 0

      // Smoothed slope over a ~100 m window. Per-point GPX slopes are very
      // noisy (GPS altitude error of a few metres over ~20 m reads as 15-25%),
      // and Tobler would over-penalise that noise, crushing speeds. Smoothing
      // gives the real grade.
      const SMOOTH_KM = 0.05 // 50 m each side
      const smoothSlope: number[] = new Array(pts.length).fill(0)
      for (let i = 0; i < pts.length; i++) {
        let b = i
        while (b > 0 && pts[i].dist - pts[b].dist < SMOOTH_KM) b--
        let f = i
        while (f < pts.length - 1 && pts[f].dist - pts[i].dist < SMOOTH_KM) f++
        const dd = (pts[f].dist - pts[b].dist) * 1000
        const s = dd > 0 ? ((pts[f].alt - pts[b].alt) / dd) * 100 : 0
        smoothSlope[i] = Math.max(-40, Math.min(40, s))
      }

      // Elevation gain from the smoothed profile (less noise inflation)
      let totalElevGain = 0
      for (let i = 1; i < pts.length; i++) {
        const dElev = pts[i].alt - pts[i - 1].alt
        if (dElev > 0) totalElevGain += dElev
      }

      // Per-point segment length (m)
      const segLenM: number[] = []
      for (let i = 0; i < pts.length - 1; i++) {
        segLenM.push(Math.max(1, (pts[i + 1].dist - pts[i].dist) * 1000))
      }
      segLenM.push(segLenM.length > 0 ? segLenM[segLenM.length - 1] : 1)

      // Default capacity assumes widthRatio = 0.5 for mountain trails
      const segmentCapacities = segLenM.map((len) => computeSegmentCapacity(0.5, len))
      // Technical slowdown multiplier per point (1 = none)
      const techMult: number[] = new Array(pts.length).fill(1)

      // Apply user-placed constraints (narrow / technical sections)
      for (const c of race.constraints ?? []) {
        const half = c.influenceKm / 2
        for (let i = 0; i < pts.length; i++) {
          if (Math.abs(pts[i].dist - c.dist) <= half) {
            const cap = computeSegmentCapacity(c.widthRatio, segLenM[i])
            segmentCapacities[i] = Math.min(segmentCapacities[i], cap)
            techMult[i] = Math.min(techMult[i], 1 - c.techLevel * 0.04)
          }
        }
      }

      // Distance bins for density, and the representative GPX point per bin
      const nBins = Math.max(1, Math.ceil(totalDist / DENSITY_BIN_KM))
      const binToSeg: number[] = new Array(nBins)
      let segPtr = 0
      for (let b = 0; b < nBins; b++) {
        const centerDist = (b + 0.5) * DENSITY_BIN_KM
        while (segPtr < pts.length - 1 && pts[segPtr].dist < centerDist) segPtr++
        binToSeg[b] = Math.min(pts.length - 1, segPtr)
      }

      return { race, totalDist, totalElevGain, segmentCapacities, techMult, smoothSlope, nBins, binToSeg }
    })

    // Determine global time range across all runs.
    // Per race: its own start offset + slowest finisher (~3 km/h) over its own
    // distance — then take the worst. (Pairing offset with the matching race
    // avoids over-sizing every buffer when a late wave is also the shortest.)
    const estimatedMaxSeconds =
      Math.max(
        ...raceMeta.map((m) => m.race.startOffset + (m.totalDist / 3) * 3600)
      ) + 3600

    // Build global timestamps
    const globalTimestamps: number[] = []
    for (let t = 0; t <= estimatedMaxSeconds; t += stepSeconds) {
      globalTimestamps.push(t)
    }
    const nTimestamps = globalTimestamps.length

    // Accumulation buffers for averaging across runs
    // raceId → distanceBinIndex → array of values per timestep
    const densityAccum: Map<string, Float32Array[]> = new Map()
    // Congestion = runners actually slowed by the crowd on a non-overtakable
    // (over-capacity / narrow) section — the real ingredient of a bouchon.
    const congestionAccum: Map<string, Float32Array[]> = new Map()
    for (const { race, nBins } of raceMeta) {
      densityAccum.set(
        race.id,
        Array.from({ length: nBins }, () => new Float32Array(nTimestamps))
      )
      congestionAccum.set(
        race.id,
        Array.from({ length: nBins }, () => new Float32Array(nTimestamps))
      )
    }

    // A runner is "congested" when the crowd slows them below this factor
    // (densityFactor < 1 only happens when a section is over its capacity).
    const CONGEST_THRESHOLD = 0.95

    // Harsh weather makes more runners abandon (and earlier). This is the most
    // visible consequence of the conditions in the results.
    let weatherAbandonMult = 1
    if (weather.temperature > 22) weatherAbandonMult += (weather.temperature - 22) * 0.045
    if (weather.temperature < 5) weatherAbandonMult += (5 - weather.temperature) * 0.03
    if (weather.rain) weatherAbandonMult += weather.rainIntensity * 0.6
    if (weather.fog) weatherAbandonMult += 0.1

    // For the last run, capture runner trajectories for output
    let lastRunTrajectories: Map<string, number[]> | null = null

    // ---------------------------------------------------------------------------
    // Monte-Carlo loop
    // ---------------------------------------------------------------------------
    for (let run = 0; run < nRuns; run++) {
      const isLastRun = run === nRuns - 1

      // Create fresh runners for each run
      const allRunners = races.flatMap(({ id: raceId, totalRunners, profiles }) =>
        createRunnersFromProfiles(profiles, raceId, totalRunners)
      )

      // Initialise runner states, keyed by runnerId
      const stateMap = new Map<string, RunnerState>()
      for (const runner of allRunners) {
        // Decide up-front whether this runner DNFs, and where (30–95% of race).
        // Harsh conditions raise the abandon probability.
        const abandonProb = Math.min(0.9, runner.abandonRate * weatherAbandonMult)
        const willAbandon = Math.random() < abandonProb
        stateMap.set(runner.id, {
          position: 0,
          distanceDone: 0,
          elevGainDone: 0,
          timeElapsed: 0,
          energy: 1.0,
          finished: false,
          abandoned: false,
          abandonAt: willAbandon ? 0.3 + Math.random() * 0.65 : Infinity,
          atRavito: 0,
        })
      }

      // Ravito checkpoint positions (fraction 0–1 of each race): use the
      // organiser's placed ravitos, falling back to ~33% / ~66% if none.
      const ravitoPositions: Map<string, number[]> = new Map()
      for (const { race } of raceMeta) {
        const pts = race.gpxPoints
        if (pts.length < 2) { ravitoPositions.set(race.id, []); continue }
        const placed = race.ravitos ?? []
        ravitoPositions.set(race.id, placed.length > 0 ? placed : [0.33, 0.66])
      }

      // Track which runners have already stopped at each ravito
      const visitedRavito = new Map<string, Set<number>>()
      for (const runner of allRunners) {
        visitedRavito.set(runner.id, new Set())
      }

      // Trajectory storage for last run: runnerId → positions array
      if (isLastRun) {
        lastRunTrajectories = new Map()
        for (const runner of allRunners) {
          lastRunTrajectories.set(runner.id, new Array(nTimestamps).fill(0))
        }
      }

      // Simulate timestep by timestep
      for (let tIdx = 0; tIdx < nTimestamps; tIdx++) {
        const globalTime = globalTimestamps[tIdx]

        // Compute segment density counts per race for this timestep
        const segmentCounts: Map<string, Map<number, number>> = new Map()
        for (const { race } of raceMeta) {
          const counts = new Map<number, number>()
          segmentCounts.set(race.id, counts)
        }

        // First pass: count runners per segment
        for (const runner of allRunners) {
          const state = stateMap.get(runner.id)!
          if (state.finished) continue

          const raceMet = raceMeta.find((m) => m.race.id === runner.raceId)!
          const { race } = raceMet

          // Check if this runner has started (accounting for wave start offsets)
          const raceStartTime = race.startOffset
          if (globalTime < raceStartTime) continue

          const pts = race.gpxPoints
          if (pts.length === 0) continue

          const segIdx = positionToSegmentIndex(state.position, pts.length)
          const counts = segmentCounts.get(race.id)!
          counts.set(segIdx, (counts.get(segIdx) ?? 0) + 1)
        }

        // Second pass: advance runners
        for (const runner of allRunners) {
          const state = stateMap.get(runner.id)!
          if (state.finished) continue

          const raceMet = raceMeta.find((m) => m.race.id === runner.raceId)!
          const { race, totalDist, totalElevGain, segmentCapacities, techMult, smoothSlope } = raceMet

          const raceStartTime = race.startOffset
          if (globalTime < raceStartTime) {
            // Not yet started — record position 0
            if (isLastRun && lastRunTrajectories) {
              lastRunTrajectories.get(runner.id)![tIdx] = 0
            }
            continue
          }

          const pts = race.gpxPoints
          if (pts.length === 0 || totalDist === 0) {
            state.finished = true
            continue
          }

          // Handle ravito stop
          if (state.atRavito > 0) {
            state.atRavito = Math.max(0, state.atRavito - stepSeconds)
            state.timeElapsed += stepSeconds
            if (isLastRun && lastRunTrajectories) {
              lastRunTrajectories.get(runner.id)![tIdx] = state.position
            }
            continue
          }

          // Get current GPX point
          const segIdx = positionToSegmentIndex(state.position, pts.length)
          const pt = pts[segIdx]
          const slopePct = smoothSlope[segIdx] ?? pt.slope
          const aspect = pt.aspect

          // Count runners in same segment ±5
          const counts = segmentCounts.get(race.id)!
          let localCount = 0
          for (let di = -5; di <= 5; di++) {
            const si = segIdx + di
            if (si >= 0 && si < pts.length) {
              localCount += counts.get(si) ?? 0
            }
          }
          // Capacity of the SAME ±5 window the runners were counted over
          // (summing per-segment capacities) so the density ratio is comparable.
          let capacity = 0
          for (let k = 0; k < 11; k++) {
            const si = segIdx - 5 + k
            if (si >= 0 && si < segmentCapacities.length) {
              capacity += segmentCapacities[si]
            }
          }
          capacity = Math.max(1, capacity)
          const densityFactor = computeDensityFactor(localCount, capacity)

          // Fatigue
          const fatigueFactor = computeFatigueFactor(
            state.distanceDone, state.elevGainDone,
            totalDist, totalElevGain,
            runner.fatigueFactor
          )

          // Weather
          const weatherFactor = computeWeather(aspect, slopePct, runner.techSkill, {
            temperature: weather.temperature,
            wind: weather.wind,
            windDirection: weather.windDirection,
            rain: weather.rain,
            rainIntensity: weather.rainIntensity,
            fog: weather.fog,
          })

          // Terrain factor = user-placed technical sections × per-profile
          // climbing/descending ability. The grade's effect on speed is
          // already handled by the Tobler slope factor in computeSpeed, so we
          // no longer add a second slope-based penalty here (which double-
          // counted and made hilly courses unrealistically slow). A mild
          // footing penalty is kept only for very steep, low-skill descents.
          const absSlope = Math.abs(slopePct)
          const footing = absSlope > 25 ? 0.85 + runner.techSkill * 0.15 : 1.0
          const abilityFactor = slopePct >= 0 ? runner.climbCoeff : runner.descentCoeff
          const terrainFactor = footing * (techMult[segIdx] ?? 1) * abilityFactor

          // Speed in km/h
          const speed = computeSpeed(
            runner.baseSpeed,
            slopePct,
            densityFactor,
            fatigueFactor,
            weatherFactor,
            terrainFactor
          )

          // Advance position
          const distStep = (speed / 3600) * stepSeconds // km per step
          const posStep = distStep / totalDist

          state.position = Math.min(1.0, state.position + posStep)
          state.distanceDone = state.position * totalDist
          state.timeElapsed += stepSeconds

          // Track elevation gain
          const newSegIdx = positionToSegmentIndex(state.position, pts.length)
          if (newSegIdx > segIdx) {
            for (let si = segIdx; si < newSegIdx && si + 1 < pts.length; si++) {
              const dElev = pts[si + 1].alt - pts[si].alt
              if (dElev > 0) state.elevGainDone += dElev
            }
          }

          // Check for ravito stop
          const ravitos = ravitoPositions.get(race.id) ?? []
          const visited = visitedRavito.get(runner.id)!
          for (let ri = 0; ri < ravitos.length; ri++) {
            if (!visited.has(ri) && state.position >= ravitos[ri]) {
              visited.add(ri)
              state.atRavito = runner.ravitoDuration
              break
            }
          }

          // DNF: the runner abandons before the finish and leaves the course
          if (!state.finished && state.position >= state.abandonAt) {
            state.abandoned = true
            state.finished = true
          }

          // Check finish
          if (state.position >= 1.0) {
            state.position = 1.0
            state.finished = true
          }

          // Record trajectory for last run
          if (isLastRun && lastRunTrajectories) {
            lastRunTrajectories.get(runner.id)![tIdx] = state.position
          }

          // Accumulate density into the runner's current distance bin, and
          // flag congestion when the crowd is actively slowing this runner.
          const densityArr = densityAccum.get(race.id)
          if (densityArr && densityArr.length > 0) {
            const binIdx = Math.min(
              densityArr.length - 1,
              Math.max(0, Math.floor(state.distanceDone / DENSITY_BIN_KM))
            )
            densityArr[binIdx][tIdx] += 1
            if (densityFactor < CONGEST_THRESHOLD) {
              congestionAccum.get(race.id)![binIdx][tIdx] += 1
            }
          }
        }
      } // end timestep loop

      // Yield to event loop every 10 runs to avoid blocking
      if (run % 10 === 0) {
        self.postMessage({ type: "PROGRESS", run: run + 1, total: nRuns } satisfies WorkerMessage)
        await yieldToEventLoop()
      }
    } // end run loop

    // Post final PROGRESS
    self.postMessage({ type: "PROGRESS", run: nRuns, total: nRuns } satisfies WorkerMessage)

    // ---------------------------------------------------------------------------
    // Aggregate risk map
    // ---------------------------------------------------------------------------
    // A bouchon = >=10 runners simultaneously slowed by congestion on a
    // non-overtakable section. Density gives the group size; congestion gives
    // whether they are actually stuck.
    const riskMap: RiskMapEntry[] = []
    for (const { race, nBins, binToSeg } of raceMeta) {
      const densityArr = densityAccum.get(race.id)!
      const congArr = congestionAccum.get(race.id)!
      for (let b = 0; b < nBins; b++) {
        const binDensity = densityArr[b]
        const binCong = congArr[b]
        let peakDensity = 0
        let peakCongested = 0
        let jamTime = 0 // timesteps that are a real bouchon (>= JAM_RUNNERS slowed)
        let activeTime = 0 // timesteps with at least one runner present
        for (let tIdx = 0; tIdx < nTimestamps; tIdx++) {
          const d = binDensity[tIdx] / nRuns // avg runners in this 150 m bin
          const c = binCong[tIdx] / nRuns // avg runners slowed by the crowd
          if (d > peakDensity) peakDensity = d
          if (c > peakCongested) peakCongested = c
          if (d > 0.5) activeTime++
          if (c >= JAM_RUNNERS) jamTime++
        }
        // A zone is flagged if it congests (bouchon) OR if raw crowding is high
        // (affluence hotspot), even on a wide section that still flows.
        const isJam = peakCongested >= JAM_RUNNERS / 2
        const isAffluence = peakDensity >= AFFLUENCE_THRESHOLD
        if (!isJam && !isAffluence) continue

        const jamProbability = activeTime > 0 ? jamTime / activeTime : 0
        const jamScore = (peakCongested / 25) * 0.6 + jamProbability * 0.4
        const affScore = Math.min(1, peakDensity / (AFFLUENCE_THRESHOLD * 2.5))
        const riskScore = Math.min(1.0, Math.max(isJam ? jamScore : 0, isAffluence ? affScore : 0))

        riskMap.push({
          raceId: race.id,
          segmentIndex: binToSeg[b],
          riskScore,
          jamProbability,
          peakDensity,
          // Bouchon (blocked) takes priority over a free-flowing crowd
          kind: isJam ? 'bouchon' : 'affluence',
        })
      }
    }

    // ---------------------------------------------------------------------------
    // Detect collision windows (segments with runners from multiple races)
    // ---------------------------------------------------------------------------
    const collisionWindows: CompressedSimulationResult["collisionWindows"] = []

    // Check spatial proximity between races, bin by bin
    for (let ri = 0; ri < raceMeta.length; ri++) {
      for (let rj = ri + 1; rj < raceMeta.length; rj++) {
        const metaA = raceMeta[ri]
        const metaB = raceMeta[rj]
        const raceA = metaA.race
        const raceB = metaB.race
        const ptsA = raceA.gpxPoints
        const ptsB = raceB.gpxPoints

        if (ptsA.length === 0 || ptsB.length === 0) continue

        const densA = densityAccum.get(raceA.id)!
        const densB = densityAccum.get(raceB.id)!

        for (let bA = 0; bA < metaA.nBins; bA++) {
          // Representative point for this bin of A
          const ptA = ptsA[metaA.binToSeg[bA]]
          // Find the nearest bin of B (within ~80 m) via its representative point
          let nearestBBin = -1
          let minDist = 0.08 // km
          for (let bB = 0; bB < metaB.nBins; bB++) {
            const ptB = ptsB[metaB.binToSeg[bB]]
            const d =
              Math.sqrt((ptA.lat - ptB.lat) ** 2 + (ptA.lng - ptB.lng) ** 2) * 111
            if (d < minDist) { minDist = d; nearestBBin = bB }
          }
          if (nearestBBin < 0) continue

          // Skip the start area (staggered départs aren't a catch-up)
          const distA = ptA.dist
          const distB = ptsB[metaB.binToSeg[nearestBBin]].dist
          if (distA < 0.6 && distB < 0.6) continue

          // Temporal overlap of both fields in this shared location
          let windowStart = -1
          let windowEnd = -1
          let peakOverlap = 0
          for (let tIdx = 0; tIdx < nTimestamps; tIdx++) {
            const dA = densA[bA][tIdx] / nRuns
            const dB = densB[nearestBBin][tIdx] / nRuns
            if (dA > 0.5 && dB > 0.5) {
              if (windowStart < 0) windowStart = globalTimestamps[tIdx]
              windowEnd = globalTimestamps[tIdx]
              peakOverlap = Math.max(peakOverlap, dA + dB)
            }
          }

          if (windowStart >= 0 && peakOverlap > 1) {
            collisionWindows.push({
              raceIds: [raceA.id, raceB.id],
              segmentIndex: metaA.binToSeg[bA],
              tStart: windowStart,
              tEnd: windowEnd,
              peak: peakOverlap,
            })
          }
        }
      }
    }

    // ---------------------------------------------------------------------------
    // Build compressed runner data from last run trajectories
    // ---------------------------------------------------------------------------
    const runnersData: CompressedSimulationResult["runnersData"] = []

    if (lastRunTrajectories) {
      for (const { race } of raceMeta) {
        const runners = createRunnersFromProfiles(
          race.profiles,
          race.id,
          race.totalRunners
        )
        for (const runner of runners) {
          const positions = lastRunTrajectories.get(runner.id) ?? new Array(nTimestamps).fill(0)
          runnersData.push({
            runnerId: runner.id,
            raceId: runner.raceId,
            profileLabel: runner.profileLabel,
            color: runner.color,
            positions,
          })
        }
      }
    }

    const result: CompressedSimulationResult = {
      simId: simulationId,
      globalTimestamps,
      runnersData,
      riskMap,
      collisionWindows,
    }

    self.postMessage({ type: "DONE", result } satisfies WorkerMessage)
  } catch (err) {
    self.postMessage({ type: "ERROR", message: String(err) } satisfies WorkerMessage)
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a 0–1 position fraction to a GPX point array index.
 * Clamps to valid range.
 */
function positionToSegmentIndex(position: number, nPoints: number): number {
  if (nPoints <= 1) return 0
  return Math.min(nPoints - 1, Math.max(0, Math.floor(position * (nPoints - 1))))
}

/**
 * Yield execution to the event loop so the worker can process
 * incoming messages and prevent the browser from killing it.
 */
function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}
