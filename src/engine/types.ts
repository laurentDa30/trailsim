export interface GPXPoint {
  lat: number
  lng: number
  alt: number     // metres
  dist: number    // km from start
  slope: number   // % (positive = uphill)
  aspect: number  // azimuth degrees (0=N, 90=E)
}

export interface RunnerProfile {
  id: string
  label: string
  percentage: number
  baseSpeedMin: number
  baseSpeedMax: number
  climbCoeff: number
  descentCoeff: number
  fatigueFactor: number
  techSkill: number
  ravitoDuration: number
  abandonRate: number
  color: string
}

export interface Runner {
  id: string
  raceId: string
  profileLabel: string
  baseSpeed: number
  climbCoeff: number
  descentCoeff: number
  fatigueFactor: number
  techSkill: number
  ravitoDuration: number
  abandonRate: number
  color: string
}

export interface RunnerState {
  position: number      // 0-1 along track
  distanceDone: number  // km
  elevGainDone: number  // m
  timeElapsed: number   // seconds since own start
  energy: number        // 0-1
  finished: boolean
  abandoned: boolean
  abandonAt: number     // 0-1 position where this runner DNFs (>1 = finishes)
  atRavito: number      // seconds remaining at ravito stop
}

export interface Constraint {
  dist: number          // km along the track where the section is centred
  widthRatio: number    // 0-1, lower = narrower = lower capacity
  techLevel: number     // 0-5, technical slowdown
  influenceKm: number   // length of the constrained stretch
}

export interface RaceConfig {
  id: string
  name: string
  color: string
  startOffset: number   // seconds from T0
  totalRunners: number
  gpxPoints: GPXPoint[]
  profiles: RunnerProfile[]
  constraints?: Constraint[]
  ravitos?: number[]    // ravito positions as fractions 0-1 of the race
}

export interface SimConfig {
  simulationId: string
  races: RaceConfig[]
  weather: {
    temperature: number
    wind: number
    windDirection: number
    rain: boolean
    rainIntensity: number
    fog: boolean
  }
  stepSeconds: number
  nRuns: number
  jamThreshold?: number       // runners that make a bouchon (default 10)
  affluenceThreshold?: number // runners/150m that flag an affluence hotspot (default 15)
}

export interface RiskMapEntry {
  raceId: string
  segmentIndex: number
  riskScore: number
  jamProbability: number
  peakDensity: number
  kind?: 'bouchon' | 'affluence'
}

export interface CompressedSimulationResult {
  simId: string
  globalTimestamps: number[]
  runnersData: Array<{
    runnerId: string
    raceId: string
    profileLabel: string
    color: string
    positions: number[]    // 0-1 progression at each timestamp
  }>
  riskMap: RiskMapEntry[]
  collisionWindows: Array<{
    raceIds: string[]
    segmentIndex: number
    tStart: number
    tEnd: number
    peak: number
  }>
}

export type WorkerMessage =
  | { type: 'START'; config: SimConfig }
  | { type: 'PROGRESS'; run: number; total: number }
  | { type: 'DONE'; result: CompressedSimulationResult }
  | { type: 'ERROR'; message: string }
