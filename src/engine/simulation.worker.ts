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

    if (races.length === 0) {
      self.postMessage({ type: "ERROR", message: "No races configured" } satisfies WorkerMessage)
      return
    }

    // Pre-compute race metadata
    const raceMeta = races.map((race) => {
      const pts = race.gpxPoints
      const totalDist = pts.length > 0 ? pts[pts.length - 1].dist : 0
      let totalElevGain = 0
      for (let i = 1; i < pts.length; i++) {
        const dElev = pts[i].alt - pts[i - 1].alt
        if (dElev > 0) totalElevGain += dElev
      }

      // Segment capacities (assume widthRatio = 0.5 for mountain trails)
      const segmentCapacities: number[] = []
      for (let i = 0; i < pts.length - 1; i++) {
        const segLenM = (pts[i + 1].dist - pts[i].dist) * 1000
        segmentCapacities.push(computeSegmentCapacity(0.5, Math.max(1, segLenM)))
      }
      // Last segment same as second-to-last
      if (pts.length > 1) segmentCapacities.push(segmentCapacities[segmentCapacities.length - 1])
      else segmentCapacities.push(1)

      return { race, totalDist, totalElevGain, segmentCapacities }
    })

    // Determine global time range across all runs
    // We need a single globalTimestamps array for the output
    const maxStartOffset = Math.max(...races.map((r) => r.startOffset))
    // Estimate max race time: slowest runner at ~3 km/h over longest race
    const longestRace = Math.max(...raceMeta.map((m) => m.totalDist))
    const estimatedMaxSeconds = maxStartOffset + (longestRace / 3) * 3600 + 3600

    // Build global timestamps
    const globalTimestamps: number[] = []
    for (let t = 0; t <= estimatedMaxSeconds; t += stepSeconds) {
      globalTimestamps.push(t)
    }
    const nTimestamps = globalTimestamps.length

    // Accumulation buffers for averaging across runs
    // raceId → segmentIndex → array of density values per timestep
    const densityAccum: Map<string, Float32Array[]> = new Map()
    for (const { race } of raceMeta) {
      const nSegs = race.gpxPoints.length
      const segs: Float32Array[] = Array.from({ length: nSegs }, () => new Float32Array(nTimestamps))
      densityAccum.set(race.id, segs)
    }

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
        stateMap.set(runner.id, {
          position: 0,
          distanceDone: 0,
          elevGainDone: 0,
          timeElapsed: 0,
          energy: 1.0,
          finished: false,
          atRavito: 0,
        })
      }

      // Ravito checkpoint positions (fraction 0–1 of each race)
      const ravitoPositions: Map<string, number[]> = new Map()
      for (const { race } of raceMeta) {
        const pts = race.gpxPoints
        if (pts.length < 2) { ravitoPositions.set(race.id, []); continue }
        const totalDist = pts[pts.length - 1].dist
        // Place ravito stops at ~33% and ~66% of the race
        ravitoPositions.set(race.id, [0.33, 0.66])
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
          const { race, totalDist, totalElevGain, segmentCapacities } = raceMet

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
          const slopePct = pt.slope
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
          const capacity = Math.max(1, ...Array.from({ length: 11 }, (_, k) => {
            const si = segIdx - 5 + k
            return si >= 0 && si < segmentCapacities.length ? segmentCapacities[si] : 0
          }))
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

          // Terrain technicality factor (slope-based proxy)
          const absSlope = Math.abs(slopePct)
          const terrainFactor = absSlope > 30
            ? 0.5 + (1 - runner.techSkill) * 0.2
            : absSlope > 15
            ? 0.7 + runner.techSkill * 0.15
            : 1.0

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

          // Check finish
          if (state.position >= 1.0) {
            state.position = 1.0
            state.finished = true
          }

          // Record trajectory for last run
          if (isLastRun && lastRunTrajectories) {
            lastRunTrajectories.get(runner.id)![tIdx] = state.position
          }

          // Accumulate density
          const densityArr = densityAccum.get(race.id)
          if (densityArr && segIdx < densityArr.length) {
            densityArr[segIdx][tIdx] += 1
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
    const riskMap: RiskMapEntry[] = []
    for (const { race } of raceMeta) {
      const densityArr = densityAccum.get(race.id)!
      const nSegs = race.gpxPoints.length
      for (let si = 0; si < nSegs; si++) {
        const segDensity = densityArr[si]
        let peakDensity = 0
        let totalDensity = 0
        let jamCount = 0
        for (let tIdx = 0; tIdx < nTimestamps; tIdx++) {
          const d = segDensity[tIdx] / nRuns // average across runs
          totalDensity += d
          if (d > peakDensity) peakDensity = d
          if (d > 5) jamCount++ // >5 runners/step = potential jam
        }
        if (peakDensity < 0.5) continue // skip empty segments

        const jamProbability = nTimestamps > 0 ? jamCount / nTimestamps : 0
        const riskScore = Math.min(1.0, (peakDensity / 20) * 0.6 + jamProbability * 0.4)

        riskMap.push({
          raceId: race.id,
          segmentIndex: si,
          riskScore,
          jamProbability,
          peakDensity,
        })
      }
    }

    // ---------------------------------------------------------------------------
    // Detect collision windows (segments with runners from multiple races)
    // ---------------------------------------------------------------------------
    const collisionWindows: CompressedSimulationResult["collisionWindows"] = []

    // Check spatial proximity between races
    for (let ri = 0; ri < raceMeta.length; ri++) {
      for (let rj = ri + 1; rj < raceMeta.length; rj++) {
        const raceA = raceMeta[ri].race
        const raceB = raceMeta[rj].race
        const ptsA = raceA.gpxPoints
        const ptsB = raceB.gpxPoints

        if (ptsA.length === 0 || ptsB.length === 0) continue

        const densA = densityAccum.get(raceA.id)!
        const densB = densityAccum.get(raceB.id)!

        // Find segments where both races have density at the same time
        const nSegsA = ptsA.length
        for (let si = 0; si < nSegsA; si++) {
          // Find nearest segment in race B
          const ptA = ptsA[si]
          let nearestBIdx = -1
          let minDist = 0.05 // max 50m proximity (in km)
          for (let sj = 0; sj < ptsB.length; sj++) {
            const ptB = ptsB[sj]
            const d = Math.sqrt(
              (ptA.lat - ptB.lat) ** 2 + (ptA.lng - ptB.lng) ** 2
            ) * 111 // rough km conversion
            if (d < minDist) { minDist = d; nearestBIdx = sj }
          }

          if (nearestBIdx < 0) continue

          // Check for temporal overlap
          let windowStart = -1
          let windowEnd = -1
          let peakOverlap = 0

          for (let tIdx = 0; tIdx < nTimestamps; tIdx++) {
            const dA = densA[si][tIdx] / nRuns
            const dB = densB[nearestBIdx][tIdx] / nRuns
            if (dA > 0.5 && dB > 0.5) {
              if (windowStart < 0) windowStart = globalTimestamps[tIdx]
              windowEnd = globalTimestamps[tIdx]
              peakOverlap = Math.max(peakOverlap, dA + dB)
            }
          }

          if (windowStart >= 0 && peakOverlap > 1) {
            collisionWindows.push({
              raceIds: [raceA.id, raceB.id],
              segmentIndex: si,
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
