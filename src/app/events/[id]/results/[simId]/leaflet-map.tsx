'use client'

import {
  MapContainer,
  TileLayer,
  Polyline,
  CircleMarker,
  Tooltip,
  Marker,
  Popup,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import L from 'leaflet'
import { useEffect, useMemo } from 'react'
import 'leaflet/dist/leaflet.css'
import type { GPXPoint, RiskMapEntry } from '@/engine/types'
import { logiTypeOf, type PlacedLogi } from './logistics'

interface CollisionWindow {
  raceIds: string[]
  segmentIndex: number
  tStart: number
  tEnd: number
  peak: number
}

interface RunnerData {
  runnerId: string
  raceId: string
  profileLabel: string
  color: string
  positions: number[]
}

interface LeafletMapProps {
  races: {
    id: string
    name: string
    color: string
    gpxPoints: GPXPoint[]
  }[]
  riskMap: RiskMapEntry[]
  visibleRaces: Set<string>
  highlightedSegment: { raceId: string; segmentIndex: number } | null
  rawRiskMap?: RiskMapEntry[]
  collisionWindows?: CollisionWindow[]
  runnersData?: RunnerData[]
  timeIndex?: number
  showRunners?: boolean
  showZones?: boolean
  showShared?: boolean
  showDensity?: boolean
  showHeat?: boolean
  showLogistics?: boolean
  hoverPoint?: [number, number] | null
  placedLogistics?: PlacedLogi[]
  placementType?: string | null
  onPlace?: (lat: number, lng: number) => void
  onMoveLogi?: (id: string, lat: number, lng: number) => void
  onRemoveLogi?: (id: string) => void
}

/** Builds a coloured, lettered divIcon for a logistics marker. */
function logiDivIcon(letter: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:50%;background:${color};border:2px solid #14110f;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:Inter,sans-serif">${letter}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  })
}

/** Captures map clicks while in placement mode and toggles a crosshair cursor. */
function PlacementHandler({
  placementType,
  onPlace,
}: {
  placementType?: string | null
  onPlace?: (lat: number, lng: number) => void
}) {
  const map = useMapEvents({
    click(e) {
      if (placementType && onPlace) onPlace(e.latlng.lat, e.latlng.lng)
    },
  })
  useEffect(() => {
    const container = map.getContainer()
    container.style.cursor = placementType ? 'crosshair' : ''
    return () => {
      container.style.cursor = ''
    }
  }, [placementType, map])
  return null
}

/** Flies the map to the highlighted segment whenever it changes. */
function FlyToHighlight({
  target,
}: {
  target: [number, number] | null
}) {
  const map = useMap()
  useEffect(() => {
    if (target) map.flyTo(target, Math.max(map.getZoom(), 14), { duration: 0.6 })
  }, [target, map])
  return null
}

/** Interpolate a [lat,lng] along a track from a 0–1 position fraction. */
function latLngAtPosition(points: GPXPoint[], position: number): [number, number] | null {
  const n = points.length
  if (n === 0) return null
  if (n === 1) return [points[0].lat, points[0].lng]
  const clamped = Math.max(0, Math.min(1, position))
  const f = clamped * (n - 1)
  const i0 = Math.floor(f)
  const i1 = Math.min(n - 1, i0 + 1)
  const t = f - i0
  const a = points[i0]
  const b = points[i1]
  return [a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t]
}

function getRiskColor(score: number): string {
  if (score >= 0.8) return 'var(--color-danger, #DC2626)'
  if (score >= 0.5) return 'var(--color-warning, #D97706)'
  return 'var(--color-safe, #16A34A)'
}

/**
 * Decimate a track to at most `maxPts` points for lightweight Leaflet polylines.
 * Keeps the first and last point. The elevation profile keeps the full track.
 */
function decimateTrack(track: GPXPoint[], maxPts = 400): GPXPoint[] {
  if (track.length <= maxPts) return track
  const step = Math.ceil(track.length / maxPts)
  const result: GPXPoint[] = []
  for (let i = 0; i < track.length; i += step) result.push(track[i])
  const last = track[track.length - 1]
  if (result[result.length - 1] !== last) result.push(last)
  return result
}

export default function LeafletMap({
  races,
  riskMap,
  visibleRaces,
  highlightedSegment,
  rawRiskMap = [],
  collisionWindows = [],
  runnersData = [],
  timeIndex = 0,
  showRunners = true,
  showZones = true,
  showShared = true,
  showDensity = true,
  showHeat = false,
  showLogistics = true,
  hoverPoint = null,
  placedLogistics = [],
  placementType = null,
  onPlace,
  onMoveLogi,
  onRemoveLogi,
}: LeafletMapProps) {
  // Compute center from first race with points
  const firstPoints = races.find((r) => r.gpxPoints.length > 0)?.gpxPoints
  const center: [number, number] = firstPoints
    ? [firstPoints[0].lat, firstPoints[0].lng]
    : [45.92, 6.87]

  const racesById = useMemo(() => new Map(races.map((r) => [r.id, r])), [races])

  // Live density: bin on-course runners along each track at the current time
  const densityCircles = useMemo(() => {
    if (!showDensity) return [] as { lat: number; lng: number; count: number }[]
    const bins = new Map<string, { latSum: number; lngSum: number; count: number }>()
    for (const r of runnersData) {
      if (!visibleRaces.has(r.raceId)) continue
      const pos = r.positions[timeIndex] ?? 0
      if (pos <= 0 || pos >= 1) continue
      const race = racesById.get(r.raceId)
      if (!race || race.gpxPoints.length < 2) continue
      const ll = latLngAtPosition(race.gpxPoints, pos)
      if (!ll) continue
      const key = `${r.raceId}:${Math.floor(pos * 60)}`
      const e = bins.get(key) ?? { latSum: 0, lngSum: 0, count: 0 }
      e.latSum += ll[0]
      e.lngSum += ll[1]
      e.count++
      bins.set(key, e)
    }
    const out: { lat: number; lng: number; count: number }[] = []
    for (const e of bins.values()) {
      if (e.count < 6) continue // only surface genuine crowding
      out.push({ lat: e.latSum / e.count, lng: e.lngSum / e.count, count: e.count })
    }
    return out
  }, [showDensity, runnersData, timeIndex, visibleRaces, racesById])

  // Aggregate heatmap: hotspots across the whole simulation (peak density)
  const heatPoints = useMemo(() => {
    if (!showHeat || rawRiskMap.length === 0) return [] as { lat: number; lng: number; intensity: number }[]
    const maxPeak = Math.max(1, ...rawRiskMap.map((e) => e.peakDensity))
    const pts: { lat: number; lng: number; intensity: number }[] = []
    for (const e of rawRiskMap) {
      if (!visibleRaces.has(e.raceId)) continue
      const intensity = e.peakDensity / maxPeak
      if (intensity < 0.25) continue
      const race = racesById.get(e.raceId)
      const pt = race?.gpxPoints[e.segmentIndex]
      if (!pt) continue
      pts.push({ lat: pt.lat, lng: pt.lng, intensity })
    }
    return pts
  }, [showHeat, rawRiskMap, visibleRaces, racesById])

  // Shared segments (tronçons communs): collision points between races
  const sharedPoints = useMemo(() => {
    if (!showShared) return [] as { lat: number; lng: number }[]
    const pts: { lat: number; lng: number }[] = []
    for (const cw of collisionWindows) {
      const race = racesById.get(cw.raceIds[0])
      const pt = race?.gpxPoints[cw.segmentIndex]
      if (!pt) continue
      if (cw.raceIds.some((rid) => visibleRaces.has(rid))) pts.push({ lat: pt.lat, lng: pt.lng })
    }
    return pts
  }, [showShared, collisionWindows, visibleRaces, racesById])

  // Resolve the highlighted segment to a coordinate for fly-to
  let flyTarget: [number, number] | null = null
  if (highlightedSegment) {
    const hlRace = racesById.get(highlightedSegment.raceId)
    const hlPt = hlRace?.gpxPoints[highlightedSegment.segmentIndex]
    if (hlPt) flyTarget = [hlPt.lat, hlPt.lng]
  }

  return (
    <>
      <style>{`.leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }`}</style>
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: '100%', height: '100%', background: '#14110f' }}
        zoomControl={true}
        preferCanvas={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />

        <FlyToHighlight target={flyTarget} />

        {/* Aggregate heatmap (bottom layer) */}
        {heatPoints.map((h, i) => (
          <CircleMarker
            key={`heat-${i}`}
            center={[h.lat, h.lng]}
            radius={14 + h.intensity * 16}
            pathOptions={{
              stroke: false,
              fillColor: '#DC2626',
              fillOpacity: 0.08 + h.intensity * 0.18,
            }}
          />
        ))}

        {/* Race polylines */}
        {races.map((race) => {
          if (!visibleRaces.has(race.id)) return null
          if (race.gpxPoints.length < 2) return null
          const positions: [number, number][] = decimateTrack(race.gpxPoints).map((p) => [p.lat, p.lng])
          return (
            <Polyline
              key={race.id}
              positions={positions}
              pathOptions={{ color: race.color, weight: 3, opacity: 0.85 }}
            >
              <Tooltip sticky>{race.name}</Tooltip>
            </Polyline>
          )
        })}

        {/* Live density crowding (under the runner dots) */}
        {densityCircles.map((d, i) => (
          <CircleMarker
            key={`dens-${i}`}
            center={[d.lat, d.lng]}
            radius={Math.min(28, 8 + d.count * 0.8)}
            pathOptions={{
              stroke: false,
              fillColor: '#D97706',
              fillOpacity: 0.22,
            }}
          />
        ))}

        {/* Shared segments (tronçons communs) */}
        {sharedPoints.map((s, i) => (
          <CircleMarker
            key={`shared-${i}`}
            center={[s.lat, s.lng]}
            radius={9}
            pathOptions={{
              color: '#A78BFA',
              fillColor: '#A78BFA',
              fillOpacity: 0.25,
              weight: 2,
              dashArray: '3 3',
            }}
          >
            <Tooltip>Tronçon commun</Tooltip>
          </CircleMarker>
        ))}

        {/* Runner dots at current time (started, not finished) */}
        {showRunners &&
          runnersData.map((runner) => {
            if (!visibleRaces.has(runner.raceId)) return null
            const pos = runner.positions[timeIndex] ?? 0
            if (pos <= 0 || pos >= 1) return null // not started or finished
            const race = racesById.get(runner.raceId)
            if (!race || race.gpxPoints.length < 2) return null
            const latlng = latLngAtPosition(race.gpxPoints, pos)
            if (!latlng) return null
            return (
              <CircleMarker
                key={runner.runnerId}
                center={latlng}
                radius={2.5}
                pathOptions={{
                  color: runner.color,
                  fillColor: runner.color,
                  fillOpacity: 0.85,
                  weight: 0,
                }}
              />
            )
          })}

        {/* Risk zone markers */}
        {showZones && riskMap.map((entry, i) => {
          const race = races.find((r) => r.id === entry.raceId)
          if (!race || !visibleRaces.has(race.id)) return null
          const point = race.gpxPoints[entry.segmentIndex]
          if (!point) return null
          const color = getRiskColor(entry.riskScore)
          const isHighlighted =
            highlightedSegment?.raceId === entry.raceId &&
            highlightedSegment?.segmentIndex === entry.segmentIndex
          return (
            <CircleMarker
              key={`risk-${i}`}
              center={[point.lat, point.lng]}
              radius={isHighlighted ? 10 : 6}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: isHighlighted ? 0.95 : 0.75,
                weight: isHighlighted ? 2.5 : 1.5,
              }}
            >
              <Tooltip>
                <span>
                  {race.name} · km {point.dist.toFixed(1)}
                  <br />
                  Risque : {Math.round(entry.riskScore * 100)}
                </span>
              </Tooltip>
            </CircleMarker>
          )
        })}

        {/* Click-to-place handler */}
        <PlacementHandler placementType={placementType} onPlace={onPlace} />

        {/* Hover marker following the elevation profile */}
        {hoverPoint && (
          <CircleMarker
            center={hoverPoint}
            radius={6}
            pathOptions={{
              color: '#ffffff',
              fillColor: 'var(--color-lime, #7CB518)',
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}

        {/* Placed logistics markers (draggable) */}
        {showLogistics && placedLogistics.map((logi) => {
          const meta = logiTypeOf(logi.type)
          return (
            <Marker
              key={logi.id}
              position={[logi.lat, logi.lng]}
              icon={logiDivIcon(meta.letter, meta.color)}
              draggable
              eventHandlers={{
                dragend: (e) => {
                  const m = e.target as L.Marker
                  const ll = m.getLatLng()
                  onMoveLogi?.(logi.id, ll.lat, ll.lng)
                },
              }}
            >
              <Popup>
                <div style={{ minWidth: 140 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: meta.color }}>
                    {meta.label}
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#666' }}>
                    {logi.lat.toFixed(5)}, {logi.lng.toFixed(5)}
                  </div>
                  <button
                    onClick={() => onRemoveLogi?.(logi.id)}
                    style={{
                      marginTop: 8,
                      width: '100%',
                      padding: '4px 8px',
                      borderRadius: 6,
                      border: '1px solid #DC2626',
                      background: '#DC262611',
                      color: '#DC2626',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Supprimer
                  </button>
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </>
  )
}
