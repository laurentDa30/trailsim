/**
 * Demo data for TrailSim.
 *
 * Two exports:
 *  1. buildDemoData() – full procedural "Trail des Aiguilles" dataset with
 *     Catmull-Rom generated tracks, runner profiles, zones, and logistics.
 *  2. DEMO_SIM_CONFIG – a compact SimConfig for quick worker testing.
 *  3. DEMO_LOG_LINES – UI log strings for the simulation console.
 */

import type { GPXPoint, RaceConfig, RunnerProfile, SimConfig } from "./types"

// ---------------------------------------------------------------------------
// Race colours
// ---------------------------------------------------------------------------

export const DEFAULT_RACE_COLORS = {
  c50: "#7CB518",
  c20: "#38BDF8",
  c10: "#F472B6",
}

// ---------------------------------------------------------------------------
// Internal helpers (seeded pseudo-random, geometry, spline)
// ---------------------------------------------------------------------------

/** Simple seeded LCG pseudo-random number generator (returns 0–1). */
function makeRng(seed: number) {
  let s = seed >>> 0
  return function rng(): number {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0
    return s / 0xffffffff
  }
}

/** Haversine distance in km between two lat/lng points. */
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Bearing from point 1 → 2 in degrees (0=N, 90=E). */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

interface Anchor {
  lat: number
  lng: number
  alt: number
}

/** Catmull-Rom spline interpolation between 4 anchors, parameter t in [0,1]. */
function catmull(
  p0: Anchor,
  p1: Anchor,
  p2: Anchor,
  p3: Anchor,
  t: number
): Anchor {
  const t2 = t * t
  const t3 = t2 * t
  const interp = (v0: number, v1: number, v2: number, v3: number) =>
    0.5 *
    (2 * v1 +
      (-v0 + v2) * t +
      (2 * v0 - 5 * v1 + 4 * v2 - v3) * t2 +
      (-v0 + 3 * v1 - 3 * v2 + v3) * t3)

  return {
    lat: interp(p0.lat, p1.lat, p2.lat, p3.lat),
    lng: interp(p0.lng, p1.lng, p2.lng, p3.lng),
    alt: interp(p0.alt, p1.alt, p2.alt, p3.alt),
  }
}

/**
 * Procedural elevation model for the Chamonix valley region.
 */
function elevAt(lat: number, lng: number): number {
  const baseLat = 45.924
  const baseLng = 6.869
  const dLat = lat - baseLat
  const dLng = lng - baseLng
  const dist = Math.sqrt(dLat * dLat + dLng * dLng)
  const base = 1035 + dist * 12000
  const ridgeDist = Math.abs(dLat - dLng * 0.5) * 8000
  const ridgeBoost = Math.max(0, 800 - ridgeDist * 2)
  const tex =
    Math.sin(lat * 800) * 30 +
    Math.cos(lng * 600) * 25 +
    Math.sin((lat + lng) * 400) * 15
  return Math.max(1035, base + ridgeBoost + tex)
}

/** Scale anchors array so total haversine length ≈ targetKm. */
function scaleAnchors(anchors: Anchor[], targetKm: number): Anchor[] {
  if (anchors.length < 2) return anchors
  let totalDist = 0
  for (let i = 1; i < anchors.length; i++) {
    totalDist += haversineKm(
      anchors[i - 1].lat, anchors[i - 1].lng,
      anchors[i].lat, anchors[i].lng
    )
  }
  if (totalDist === 0) return anchors
  const scale = targetKm / totalDist
  const centLat = anchors[0].lat
  const centLng = anchors[0].lng
  return anchors.map((a, idx) =>
    idx === 0
      ? a
      : { lat: centLat + (a.lat - centLat) * scale, lng: centLng + (a.lng - centLng) * scale, alt: a.alt }
  )
}

/** Build GPXPoint[] from anchors using Catmull-Rom splines. */
function buildTrack(anchors: Anchor[], stepsPerSegment = 20): GPXPoint[] {
  if (anchors.length < 2) return []
  const raw: Array<{ lat: number; lng: number; alt: number }> = []

  const pts = [anchors[0], ...anchors, anchors[anchors.length - 1]]
  for (let i = 1; i < pts.length - 2; i++) {
    for (let s = 0; s < stepsPerSegment; s++) {
      const p = catmull(pts[i - 1], pts[i], pts[i + 1], pts[i + 2], s / stepsPerSegment)
      raw.push(p)
    }
  }
  raw.push(anchors[anchors.length - 1])

  const enriched = raw.map((p) => ({ ...p, alt: p.alt > 0 ? p.alt : elevAt(p.lat, p.lng) }))

  const cumDist: number[] = [0]
  for (let i = 1; i < enriched.length; i++) {
    cumDist.push(cumDist[i - 1] + haversineKm(
      enriched[i - 1].lat, enriched[i - 1].lng,
      enriched[i].lat, enriched[i].lng
    ))
  }

  const SMOOTH_M = 20
  const slopes: number[] = new Array(enriched.length).fill(0)
  for (let i = 0; i < enriched.length; i++) {
    const distI = cumDist[i] * 1000
    let fwd = i
    while (fwd < enriched.length - 1 && cumDist[fwd] * 1000 - distI < SMOOTH_M / 2) fwd++
    let bwd = i
    while (bwd > 0 && distI - cumDist[bwd] * 1000 < SMOOTH_M / 2) bwd--
    const horizDist = (cumDist[fwd] - cumDist[bwd]) * 1000
    slopes[i] = horizDist > 0.1 ? ((enriched[fwd].alt - enriched[bwd].alt) / horizDist) * 100 : 0
  }

  const aspects: number[] = new Array(enriched.length).fill(0)
  for (let i = 0; i < enriched.length; i++) {
    const next = Math.min(i + 1, enriched.length - 1)
    const prev = Math.max(i - 1, 0)
    if (next !== prev) {
      aspects[i] = bearing(enriched[prev].lat, enriched[prev].lng, enriched[next].lat, enriched[next].lng)
    }
  }

  return enriched.map((p, i) => ({
    lat: p.lat, lng: p.lng, alt: p.alt,
    dist: cumDist[i], slope: slopes[i], aspect: aspects[i],
  }))
}

// ---------------------------------------------------------------------------
// Loop anchor generators
// ---------------------------------------------------------------------------

function loopBig(rng: () => number): Anchor[] {
  const base = { lat: 45.924, lng: 6.869 }
  const j = () => (rng() - 0.5) * 0.003
  return [
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
    { lat: base.lat + 0.040 + j(), lng: base.lng + 0.015 + j(), alt: 1500 },
    { lat: base.lat + 0.080 + j(), lng: base.lng + 0.025 + j(), alt: 1950 },
    { lat: base.lat + 0.110 + j(), lng: base.lng + 0.005 + j(), alt: 2380 },
    { lat: base.lat + 0.130 + j(), lng: base.lng - 0.020 + j(), alt: 2650 },
    { lat: base.lat + 0.145 + j(), lng: base.lng - 0.055 + j(), alt: 2900 },
    { lat: base.lat + 0.120 + j(), lng: base.lng - 0.090 + j(), alt: 2500 },
    { lat: base.lat + 0.080 + j(), lng: base.lng - 0.110 + j(), alt: 2100 },
    { lat: base.lat + 0.040 + j(), lng: base.lng - 0.100 + j(), alt: 1700 },
    { lat: base.lat + 0.005 + j(), lng: base.lng - 0.075 + j(), alt: 1350 },
    { lat: base.lat - 0.020 + j(), lng: base.lng - 0.040 + j(), alt: 1150 },
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
  ]
}

function loopMed(rng: () => number): Anchor[] {
  const base = { lat: 45.924, lng: 6.869 }
  const j = () => (rng() - 0.5) * 0.002
  return [
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
    { lat: base.lat + 0.025 + j(), lng: base.lng + 0.020 + j(), alt: 1350 },
    { lat: base.lat + 0.055 + j(), lng: base.lng + 0.030 + j(), alt: 1700 },
    { lat: base.lat + 0.075 + j(), lng: base.lng + 0.010 + j(), alt: 2050 },
    { lat: base.lat + 0.065 + j(), lng: base.lng - 0.025 + j(), alt: 2200 },
    { lat: base.lat + 0.040 + j(), lng: base.lng - 0.045 + j(), alt: 1900 },
    { lat: base.lat + 0.015 + j(), lng: base.lng - 0.040 + j(), alt: 1550 },
    { lat: base.lat - 0.005 + j(), lng: base.lng - 0.020 + j(), alt: 1200 },
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
  ]
}

function loopSmall(rng: () => number): Anchor[] {
  const base = { lat: 45.924, lng: 6.869 }
  const j = () => (rng() - 0.5) * 0.001
  return [
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
    { lat: base.lat + 0.015 + j(), lng: base.lng + 0.015 + j(), alt: 1250 },
    { lat: base.lat + 0.030 + j(), lng: base.lng + 0.015 + j(), alt: 1500 },
    { lat: base.lat + 0.040 + j(), lng: base.lng + 0.000 + j(), alt: 1650 },
    { lat: base.lat + 0.030 + j(), lng: base.lng - 0.020 + j(), alt: 1450 },
    { lat: base.lat + 0.015 + j(), lng: base.lng - 0.020 + j(), alt: 1250 },
    { lat: base.lat,              lng: base.lng,              alt: 1035 },
  ]
}

// ---------------------------------------------------------------------------
// Runner profiles per race
// ---------------------------------------------------------------------------

function makeProfiles(raceId: string, distanceKm: number): RunnerProfile[] {
  const s = distanceKm >= 40 ? 0.75 : distanceKm >= 15 ? 0.88 : 1.0

  if (raceId === "c50") {
    return [
      { id: "elite",       label: "Elite",        percentage: 5,  baseSpeedMin: 9.5 * s,  baseSpeedMax: 11.5 * s, climbCoeff: 0.85, descentCoeff: 1.10, fatigueFactor: 0.72, techSkill: 0.95, ravitoDuration: 120, abandonRate: 0.03, color: "#FFD700" },
      { id: "experienced", label: "Expérimenté",  percentage: 25, baseSpeedMin: 7.0 * s,  baseSpeedMax: 9.0 * s,  climbCoeff: 0.78, descentCoeff: 1.00, fatigueFactor: 0.65, techSkill: 0.80, ravitoDuration: 240, abandonRate: 0.08, color: "#FF6B35" },
      { id: "amateur",     label: "Amateur",       percentage: 50, baseSpeedMin: 5.0 * s,  baseSpeedMax: 7.5 * s,  climbCoeff: 0.68, descentCoeff: 0.90, fatigueFactor: 0.55, techSkill: 0.65, ravitoDuration: 360, abandonRate: 0.15, color: DEFAULT_RACE_COLORS.c50 },
      { id: "novice",      label: "Novice",        percentage: 20, baseSpeedMin: 3.5 * s,  baseSpeedMax: 5.5 * s,  climbCoeff: 0.60, descentCoeff: 0.80, fatigueFactor: 0.45, techSkill: 0.50, ravitoDuration: 480, abandonRate: 0.25, color: "#A78BFA" },
    ]
  }
  if (raceId === "c20") {
    return [
      { id: "elite",       label: "Elite",        percentage: 8,  baseSpeedMin: 10.0 * s, baseSpeedMax: 13.0 * s, climbCoeff: 0.88, descentCoeff: 1.12, fatigueFactor: 0.78, techSkill: 0.93, ravitoDuration: 90,  abandonRate: 0.02, color: "#FFD700" },
      { id: "experienced", label: "Expérimenté",  percentage: 35, baseSpeedMin: 7.5 * s,  baseSpeedMax: 10.5 * s, climbCoeff: 0.80, descentCoeff: 1.05, fatigueFactor: 0.70, techSkill: 0.78, ravitoDuration: 180, abandonRate: 0.06, color: DEFAULT_RACE_COLORS.c20 },
      { id: "amateur",     label: "Amateur",       percentage: 45, baseSpeedMin: 5.5 * s,  baseSpeedMax: 8.0 * s,  climbCoeff: 0.72, descentCoeff: 0.95, fatigueFactor: 0.62, techSkill: 0.62, ravitoDuration: 300, abandonRate: 0.12, color: "#34D399" },
      { id: "novice",      label: "Novice",        percentage: 12, baseSpeedMin: 4.0 * s,  baseSpeedMax: 6.0 * s,  climbCoeff: 0.62, descentCoeff: 0.85, fatigueFactor: 0.52, techSkill: 0.48, ravitoDuration: 420, abandonRate: 0.20, color: "#A78BFA" },
    ]
  }
  // c10
  return [
    { id: "elite",       label: "Elite",        percentage: 10, baseSpeedMin: 11.0 * s, baseSpeedMax: 14.5 * s, climbCoeff: 0.90, descentCoeff: 1.15, fatigueFactor: 0.85, techSkill: 0.95, ravitoDuration: 60,  abandonRate: 0.01, color: "#FFD700" },
    { id: "experienced", label: "Expérimenté",  percentage: 40, baseSpeedMin: 8.0 * s,  baseSpeedMax: 11.5 * s, climbCoeff: 0.82, descentCoeff: 1.08, fatigueFactor: 0.75, techSkill: 0.76, ravitoDuration: 120, abandonRate: 0.04, color: DEFAULT_RACE_COLORS.c10 },
    { id: "amateur",     label: "Amateur",       percentage: 40, baseSpeedMin: 6.0 * s,  baseSpeedMax: 9.0 * s,  climbCoeff: 0.74, descentCoeff: 0.98, fatigueFactor: 0.68, techSkill: 0.60, ravitoDuration: 240, abandonRate: 0.08, color: "#FB923C" },
    { id: "novice",      label: "Novice",        percentage: 10, baseSpeedMin: 4.5 * s,  baseSpeedMax: 7.0 * s,  climbCoeff: 0.65, descentCoeff: 0.88, fatigueFactor: 0.58, techSkill: 0.45, ravitoDuration: 360, abandonRate: 0.15, color: "#A78BFA" },
  ]
}

// ---------------------------------------------------------------------------
// Course builder
// ---------------------------------------------------------------------------

interface CourseSpec {
  id: string
  name: string
  color: string
  targetKm: number
  startOffset: number
  totalRunners: number
  anchors: Anchor[]
}

type EnrichedRaceConfig = RaceConfig & { meta: { distance: number; elevGain: number } }

function makeCourse(spec: CourseSpec): EnrichedRaceConfig {
  const scaledAnchors = scaleAnchors(spec.anchors, spec.targetKm)
  const track = buildTrack(scaledAnchors, 25)

  const totalDist = track.length > 0 ? track[track.length - 1].dist : 0
  let elevGain = 0
  for (let i = 1; i < track.length; i++) {
    const dElev = track[i].alt - track[i - 1].alt
    if (dElev > 0) elevGain += dElev
  }

  const profiles = makeProfiles(spec.id, spec.targetKm)
  return {
    id: spec.id,
    name: spec.name,
    color: spec.color,
    startOffset: spec.startOffset,
    totalRunners: spec.totalRunners,
    gpxPoints: track,
    profiles,
    meta: { distance: Math.round(totalDist * 10) / 10, elevGain: Math.round(elevGain) },
  }
}

// ---------------------------------------------------------------------------
// Zones, collisions, logistics
// ---------------------------------------------------------------------------

export interface DemoZone {
  id: string
  name: string
  type: "ravito" | "passage" | "depart" | "arrivee"
  courses: string[]
  distanceKm: Record<string, number>
  capacity: number
  lat: number
  lng: number
}

export interface DemoCollision {
  courses: string[]
  location: string
  tStart: string
  tEnd: string
  maxRunners: number
  riskLevel: "low" | "medium" | "high"
}

export interface DemoLogistique {
  zone: string
  benevoles: number
  medics: number
  foodKg: number
  waterL: number
  toilettes: number
}

export interface DemoRessource {
  type: string
  total: number
  deployed: string[]
}

function makeZones(courses: EnrichedRaceConfig[]): DemoZone[] {
  const zones: DemoZone[] = []
  const start = courses[0]?.gpxPoints[0]
  zones.push({
    id: "z-start",
    name: "Départ / Arrivée – Chamonix",
    type: "depart",
    courses: courses.map((c) => c.id),
    distanceKm: Object.fromEntries(courses.map((c) => [c.id, 0])),
    capacity: 200,
    lat: start?.lat ?? 45.924,
    lng: start?.lng ?? 6.869,
  })

  for (const course of courses) {
    const pts = course.gpxPoints
    if (pts.length === 0) continue
    const totalDist = pts[pts.length - 1].dist
    for (const frac of [0.35, 0.65]) {
      const targetDist = totalDist * frac
      let closest = 0
      let minDiff = Infinity
      for (let i = 0; i < pts.length; i++) {
        const diff = Math.abs(pts[i].dist - targetDist)
        if (diff < minDiff) { minDiff = diff; closest = i }
      }
      const pt = pts[closest]
      zones.push({
        id: `z-${course.id}-${Math.round(frac * 100)}`,
        name: `Ravito ${course.name} – ${Math.round(frac * 100)}%`,
        type: "ravito",
        courses: [course.id],
        distanceKm: { [course.id]: Math.round(pt.dist * 10) / 10 },
        capacity: 50,
        lat: pt.lat,
        lng: pt.lng,
      })
    }
  }

  return zones
}

function makeCollisions(courses: EnrichedRaceConfig[]): DemoCollision[] {
  const windows: DemoCollision[] = []
  windows.push({
    courses: courses.map((c) => c.id),
    location: "Corridor départ",
    tStart: "T+00:00", tEnd: "T+00:15",
    maxRunners: courses.reduce((s, c) => s + c.totalRunners, 0),
    riskLevel: "high",
  })
  if (courses.find((c) => c.id === "c50") && courses.find((c) => c.id === "c20")) {
    windows.push({
      courses: ["c50", "c20"],
      location: "Sortie Chamonix – km 3",
      tStart: "T+00:20", tEnd: "T+01:10",
      maxRunners: 420,
      riskLevel: "high",
    })
  }
  if (courses.find((c) => c.id === "c20") && courses.find((c) => c.id === "c10")) {
    windows.push({
      courses: ["c20", "c10"],
      location: "Descente Plan de l'Aiguille",
      tStart: "T+01:30", tEnd: "T+02:45",
      maxRunners: 280,
      riskLevel: "medium",
    })
  }
  return windows
}

function makeLogistique(zones: DemoZone[]): DemoLogistique[] {
  return zones.map((z) => ({
    zone: z.name,
    benevoles: z.type === "depart" ? 40 : 15,
    medics: z.type === "depart" ? 4 : 2,
    foodKg: z.capacity * 0.5,
    waterL: z.capacity * 2,
    toilettes: Math.max(2, Math.floor(z.capacity / 30)),
  }))
}

function makeRessources(zones: DemoZone[]): DemoRessource[] {
  return [
    { type: "Bénévoles", total: zones.reduce((s, z) => s + (z.type === "depart" ? 40 : 15), 0), deployed: zones.map((z) => z.id) },
    { type: "Médecins/secouristes", total: zones.reduce((s, z) => s + (z.type === "depart" ? 4 : 2), 0), deployed: zones.map((z) => z.id) },
    { type: "Véhicules logistique", total: 8, deployed: zones.filter((z) => z.type !== "passage").map((z) => z.id) },
  ]
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface DemoData {
  courses: EnrichedRaceConfig[]
  runners: Record<string, number>
  zones: DemoZone[]
  collisions: DemoCollision[]
  logistique: DemoLogistique[]
  ressources: DemoRessource[]
  meta: {
    eventName: string
    location: string
    date: string
    totalParticipants: number
  }
}

/**
 * Build the full "Trail des Aiguilles" procedural demo dataset.
 * Deterministic (seeded RNG) so the same track is produced each time.
 */
export function buildDemoData(): DemoData {
  const rng50 = makeRng(0xdeadbeef)
  const rng20 = makeRng(0xcafebabe)
  const rng10 = makeRng(0x12345678)

  const c50 = makeCourse({ id: "c50", name: "Trail des Aiguilles 50K", color: DEFAULT_RACE_COLORS.c50, targetKm: 50, startOffset: 0,         totalRunners: 350, anchors: loopBig(rng50)   })
  const c20 = makeCourse({ id: "c20", name: "Trail des Aiguilles 20K", color: DEFAULT_RACE_COLORS.c20, targetKm: 20, startOffset: 2 * 3600,  totalRunners: 280, anchors: loopMed(rng20)   })
  const c10 = makeCourse({ id: "c10", name: "Trail des Aiguilles 10K", color: DEFAULT_RACE_COLORS.c10, targetKm: 10, startOffset: 3 * 3600,  totalRunners: 200, anchors: loopSmall(rng10) })

  const courses = [c50, c20, c10]
  const zones = makeZones(courses)

  return {
    courses,
    runners: Object.fromEntries(courses.map((c) => [c.id, c.totalRunners])),
    zones,
    collisions: makeCollisions(courses),
    logistique: makeLogistique(zones),
    ressources: makeRessources(zones),
    meta: {
      eventName: "Trail des Aiguilles",
      location: "Chamonix-Mont-Blanc, France",
      date: "2025-07-12",
      totalParticipants: courses.reduce((s, c) => s + c.totalRunners, 0),
    },
  }
}

// ---------------------------------------------------------------------------
// Legacy quick-test SimConfig (no generated GPX – used for worker tests)
// ---------------------------------------------------------------------------

export const DEMO_SIM_CONFIG: SimConfig = {
  simulationId: "demo-sim-001",
  races: [
    {
      id: "race-50k",
      name: "50 km",
      color: "#7CB518",
      startOffset: 0,
      totalRunners: 140,
      gpxPoints: [],
      profiles: [
        {
          id: "elite",
          label: "Élite",
          percentage: 5,
          baseSpeedMin: 12,
          baseSpeedMax: 18,
          climbCoeff: 1.2,
          descentCoeff: 1.1,
          fatigueFactor: 0.9,
          techSkill: 0.95,
          ravitoDuration: 30,
          abandonRate: 0.02,
          color: "#7CB518",
        },
        {
          id: "confirme",
          label: "Confirmé",
          percentage: 20,
          baseSpeedMin: 9,
          baseSpeedMax: 12,
          climbCoeff: 1.0,
          descentCoeff: 1.0,
          fatigueFactor: 0.8,
          techSkill: 0.75,
          ravitoDuration: 60,
          abandonRate: 0.05,
          color: "#38BDF8",
        },
        {
          id: "intermediaire",
          label: "Intermédiaire",
          percentage: 35,
          baseSpeedMin: 7,
          baseSpeedMax: 9,
          climbCoeff: 0.9,
          descentCoeff: 0.9,
          fatigueFactor: 0.7,
          techSkill: 0.6,
          ravitoDuration: 90,
          abandonRate: 0.08,
          color: "#F472B6",
        },
        {
          id: "debutant",
          label: "Débutant",
          percentage: 30,
          baseSpeedMin: 5,
          baseSpeedMax: 7,
          climbCoeff: 0.7,
          descentCoeff: 0.8,
          fatigueFactor: 0.6,
          techSkill: 0.4,
          ravitoDuration: 120,
          abandonRate: 0.12,
          color: "#FBBF24",
        },
        {
          id: "marcheur",
          label: "Marcheur",
          percentage: 10,
          baseSpeedMin: 3,
          baseSpeedMax: 5,
          climbCoeff: 0.5,
          descentCoeff: 0.7,
          fatigueFactor: 0.5,
          techSkill: 0.3,
          ravitoDuration: 180,
          abandonRate: 0.15,
          color: "#A78BFA",
        },
      ],
    },
    {
      id: "race-20k",
      name: "20 km",
      color: "#38BDF8",
      startOffset: 1800,
      totalRunners: 100,
      gpxPoints: [],
      profiles: [
        {
          id: "elite-20k",
          label: "Élite",
          percentage: 8,
          baseSpeedMin: 13,
          baseSpeedMax: 18,
          climbCoeff: 1.2,
          descentCoeff: 1.1,
          fatigueFactor: 0.92,
          techSkill: 0.95,
          ravitoDuration: 20,
          abandonRate: 0.01,
          color: "#7CB518",
        },
        {
          id: "confirme-20k",
          label: "Confirmé",
          percentage: 35,
          baseSpeedMin: 9,
          baseSpeedMax: 13,
          climbCoeff: 1.0,
          descentCoeff: 1.0,
          fatigueFactor: 0.82,
          techSkill: 0.75,
          ravitoDuration: 45,
          abandonRate: 0.03,
          color: "#38BDF8",
        },
        {
          id: "debutant-20k",
          label: "Débutant",
          percentage: 57,
          baseSpeedMin: 5,
          baseSpeedMax: 9,
          climbCoeff: 0.75,
          descentCoeff: 0.85,
          fatigueFactor: 0.65,
          techSkill: 0.5,
          ravitoDuration: 90,
          abandonRate: 0.08,
          color: "#FBBF24",
        },
      ],
    },
  ],
  weather: {
    temperature: 18,
    wind: 15,
    windDirection: 225,
    rain: false,
    rainIntensity: 0,
    fog: false,
  },
  stepSeconds: 60,
  nRuns: 100,
}

export const DEMO_LOG_LINES = [
  "Initialisation du moteur de simulation...",
  "Chargement des profils de coureurs (240 au total)",
  "Génération du peloton — course 50 km : 140 coureurs",
  "Génération du peloton — course 20 km : 100 coureurs",
  "Calcul des points de départ et intervalles de temps",
  "Run 1/100 — T0+00:00 départ vague élite (50 km)",
  "Run 1/100 — T0+30:00 départ vague standard (20 km)",
  "Run 5/100 — densité calculée : segment 3 (km 8.4) = 42 coureurs/km",
  "Run 10/100 — premier goulet détecté : km 12.1, largeur 1.2m",
  "Run 15/100 — analyse fatigue : pic km 34 (50 km)",
  "Run 20/100 — collision cross-race détectée : km 8.4 @ T+02:15",
  "Run 25/100 — recalcul trajectoires alternatives...",
  "Run 30/100 — indice de risque calculé pour 12 segments",
  "Run 40/100 — optimisation ravitaillements en cours",
  "Run 50/100 — mi-parcours simulation",
  "Run 55/100 — analyse points sensibles : 3 zones critiques",
  "Run 60/100 — projection abandons : 8.2% (50 km), 4.1% (20 km)",
  "Run 70/100 — cartographie densité mise à jour",
  "Run 75/100 — fenêtres de collision identifiées : 4",
  "Run 80/100 — calcul précision Monte Carlo : 94.2%",
  "Run 85/100 — raffinement zones à risque...",
  "Run 90/100 — agrégation résultats en cours",
  "Run 95/100 — génération rapport de risques",
  "Run 100/100 — finalisation",
  "Calcul snapshot résultats...",
  "Sérialisation données (2.4 MB)",
  "Simulation terminée avec succès",
]
