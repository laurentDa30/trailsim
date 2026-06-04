import type { GPXPoint } from './types'

/**
 * Haversine distance between two lat/lng points in kilometres.
 */
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

/**
 * Compute the bearing (azimuth in degrees, 0=N, 90=E) from point 1 to point 2.
 */
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δλ = ((lng2 - lng1) * Math.PI) / 180
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/**
 * Parse a GPX XML string into an array of GPXPoint objects.
 *
 * Uses DOMParser to extract trkpt elements, calculates cumulative distances
 * with the haversine formula, and computes slope using a 20 m smoothing window.
 * Aspect (direction of travel) is calculated from consecutive points.
 *
 * @param gpxXml - raw GPX XML string
 * @returns array of GPXPoint, empty if parsing fails
 */
export function parseGPX(gpxXml: string): GPXPoint[] {
  if (!gpxXml || gpxXml.trim().length === 0) return []

  let doc: Document
  try {
    const parser = new DOMParser()
    doc = parser.parseFromString(gpxXml, 'application/xml')
    // Check for parse errors
    const parseError = doc.querySelector('parsererror')
    if (parseError) return []
  } catch {
    return []
  }

  const trkpts = Array.from(doc.querySelectorAll('trkpt'))
  if (trkpts.length === 0) return []

  // First pass: extract raw lat/lng/ele
  interface RawPoint {
    lat: number
    lng: number
    alt: number
  }

  const raw: RawPoint[] = trkpts.map((pt) => {
    const lat = parseFloat(pt.getAttribute('lat') ?? '0')
    const lng = parseFloat(pt.getAttribute('lon') ?? '0')
    const eleEl = pt.querySelector('ele')
    const alt = eleEl ? parseFloat(eleEl.textContent ?? '0') : 0
    return { lat, lng, alt }
  })

  if (raw.length === 0) return []

  // Second pass: compute cumulative distances
  const cumDist: number[] = [0]
  for (let i = 1; i < raw.length; i++) {
    const d = haversineKm(raw[i - 1].lat, raw[i - 1].lng, raw[i].lat, raw[i].lng)
    cumDist.push(cumDist[i - 1] + d)
  }

  const totalKm = cumDist[cumDist.length - 1]

  // Third pass: compute slope using 20 m smoothing window
  // For each point i, find points within ±10m and average elevation change
  const SMOOTH_M = 20
  const slopes: number[] = new Array(raw.length).fill(0)

  for (let i = 0; i < raw.length; i++) {
    const distI = cumDist[i] * 1000 // convert to metres

    // Find forward point ~10m ahead
    let fwd = i
    while (fwd < raw.length - 1 && cumDist[fwd] * 1000 - distI < SMOOTH_M / 2) {
      fwd++
    }
    // Find backward point ~10m behind
    let bwd = i
    while (bwd > 0 && distI - cumDist[bwd] * 1000 < SMOOTH_M / 2) {
      bwd--
    }

    const horizDist = (cumDist[fwd] - cumDist[bwd]) * 1000 // metres
    const elevDiff = raw[fwd].alt - raw[bwd].alt

    if (horizDist > 0.1) {
      slopes[i] = (elevDiff / horizDist) * 100 // percent
    } else {
      slopes[i] = 0
    }
  }

  // Fourth pass: compute aspects (direction of travel)
  const aspects: number[] = new Array(raw.length).fill(0)
  for (let i = 0; i < raw.length; i++) {
    const next = Math.min(i + 1, raw.length - 1)
    const prev = Math.max(i - 1, 0)
    if (next !== prev) {
      aspects[i] = bearing(raw[prev].lat, raw[prev].lng, raw[next].lat, raw[next].lng)
    }
  }

  // Assemble final GPXPoint array
  return raw.map((pt, i) => ({
    lat: pt.lat,
    lng: pt.lng,
    alt: pt.alt,
    dist: totalKm > 0 ? cumDist[i] : 0,
    slope: slopes[i],
    aspect: aspects[i],
  }))
}
