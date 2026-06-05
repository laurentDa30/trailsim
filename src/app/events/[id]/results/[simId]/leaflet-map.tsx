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
import { useEffect, useMemo, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import type { GPXPoint, RiskMapEntry } from '@/engine/types'
import { logiTypeOf, type PlacedLogi } from './logistics'

interface DrawItem {
  lat: number
  lng: number
  r: number
  fill: string
  alpha: number
  /** Render as a soft radial blob (cloud) instead of a hard disc. */
  soft?: boolean
}

/** "#RRGGBB" → "rgba(r,g,b,a)" */
function hexToRgba(hex: string, a: number): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex)
  if (!m) return hex
  const r = parseInt(m[1], 16)
  const g = parseInt(m[2], 16)
  const b = parseInt(m[3], 16)
  return `rgba(${r},${g},${b},${a})`
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Single canvas layer that draws runners / density / heat / shared dots.
 * Rendering hundreds of these as react-leaflet markers caused the map to
 * stutter and glitch on every pan, zoom and timeline tick — one canvas that
 * redraws on map events is far cheaper and stable.
 */
function CanvasOverlay({ items }: { items: DrawItem[] }) {
  const map = useMap()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const itemsRef = useRef<DrawItem[]>(items)
  const drawRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = L.DomUtil.create('canvas', 'ts-runner-canvas') as HTMLCanvasElement
    canvas.style.position = 'absolute'
    canvas.style.pointerEvents = 'none'
    map.getPanes().overlayPane.appendChild(canvas)
    canvasRef.current = canvas

    const draw = () => {
      const size = map.getSize()
      const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
      const topLeft = map.containerPointToLayerPoint([0, 0])
      L.DomUtil.setPosition(canvas, topLeft)
      canvas.width = size.x * dpr
      canvas.height = size.y * dpr
      canvas.style.width = `${size.x}px`
      canvas.style.height = `${size.y}px`
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, size.x, size.y)
      for (const it of itemsRef.current) {
        const p = map.latLngToContainerPoint([it.lat, it.lng])
        if (it.soft) {
          // Cloud: radial gradient fading to transparent at the edge
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, it.r)
          grad.addColorStop(0, hexToRgba(it.fill, it.alpha))
          grad.addColorStop(1, hexToRgba(it.fill, 0))
          ctx.fillStyle = grad
          ctx.beginPath()
          ctx.arc(p.x, p.y, it.r, 0, Math.PI * 2)
          ctx.fill()
        } else {
          ctx.globalAlpha = it.alpha
          ctx.fillStyle = it.fill
          ctx.beginPath()
          ctx.arc(p.x, p.y, it.r, 0, Math.PI * 2)
          ctx.fill()
          ctx.globalAlpha = 1
        }
      }
      ctx.globalAlpha = 1
    }

    drawRef.current = draw
    map.on('move zoom viewreset resize', draw)
    draw()
    return () => {
      map.off('move zoom viewreset resize', draw)
      canvas.remove()
    }
  }, [map])

  // Redraw when the item set changes (timeline tick, layer toggles, …)
  useEffect(() => {
    itemsRef.current = items
    drawRef.current()
  }, [items])

  return null
}

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
  highlightedCollision?: number | null
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
  highlightedCollision = null,
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
      if (e.count < 3) continue // only surface genuine crowding
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

  // Shared segments (tronçons communs): where two course traces physically
  // overlap (within ~35 m), excluding the start area (each race starts apart
  // in time, so the common start line is not a meaningful merge point).
  const sharedPoints = useMemo(() => {
    if (!showShared) return [] as { lat: number; lng: number }[]
    const visible = races.filter((r) => visibleRaces.has(r.id) && r.gpxPoints.length > 1)
    const pts: { lat: number; lng: number }[] = []
    const THRESH_KM = 0.035
    const START_EXCL_KM = 0.5
    const stepOf = (pp: GPXPoint[]) => Math.max(1, Math.floor(pp.length / 250))
    for (let i = 0; i < visible.length; i++) {
      for (let j = i + 1; j < visible.length; j++) {
        const A = visible[i].gpxPoints
        const B = visible[j].gpxPoints
        const sa = stepOf(A)
        const sb = stepOf(B)
        for (let a = 0; a < A.length; a += sa) {
          const pa = A[a]
          if (pa.dist < START_EXCL_KM) continue
          for (let b = 0; b < B.length; b += sb) {
            const pb = B[b]
            if (pb.dist < START_EXCL_KM) continue
            if (haversineKm(pa.lat, pa.lng, pb.lat, pb.lng) < THRESH_KM) {
              pts.push({ lat: pa.lat, lng: pa.lng })
              break
            }
          }
        }
      }
    }
    return pts
  }, [showShared, races, visibleRaces])

  // Runner positions at the active time (started, not finished)
  const runnerDots = useMemo(() => {
    if (!showRunners) return [] as { lat: number; lng: number; color: string }[]
    const out: { lat: number; lng: number; color: string }[] = []
    for (const r of runnersData) {
      if (!visibleRaces.has(r.raceId)) continue
      const pos = r.positions[timeIndex] ?? 0
      if (pos <= 0 || pos >= 1) continue
      const race = racesById.get(r.raceId)
      if (!race || race.gpxPoints.length < 2) continue
      const ll = latLngAtPosition(race.gpxPoints, pos)
      if (!ll) continue
      out.push({ lat: ll[0], lng: ll[1], color: r.color })
    }
    return out
  }, [showRunners, runnersData, timeIndex, visibleRaces, racesById])

  // Combined draw list for the canvas overlay (bottom → top)
  const canvasItems = useMemo<DrawItem[]>(() => {
    const items: DrawItem[] = []
    // Heatmap — soft red cloud, aggregated over the whole simulation
    for (const h of heatPoints)
      items.push({ lat: h.lat, lng: h.lng, r: 22 + h.intensity * 20, fill: '#DC2626', alpha: 0.14 + h.intensity * 0.22, soft: true })
    // Shared sections — soft violet cloud along the common track
    for (const s of sharedPoints)
      items.push({ lat: s.lat, lng: s.lng, r: 22, fill: '#A78BFA', alpha: 0.3, soft: true })
    // Live density — soft amber cloud where runners bunch up now
    for (const d of densityCircles)
      items.push({ lat: d.lat, lng: d.lng, r: Math.min(42, 18 + d.count * 1.1), fill: '#F59E0B', alpha: 0.5, soft: true })
    // Runners — crisp dots on top
    for (const rd of runnerDots)
      items.push({ lat: rd.lat, lng: rd.lng, r: 2.5, fill: rd.color, alpha: 0.85 })
    return items
  }, [heatPoints, sharedPoints, densityCircles, runnerDots])

  // Collision markers (where two courses meet), placed on the first race's point
  const collisionMarkers = useMemo(() => {
    return collisionWindows
      .map((cw, i) => {
        const race = racesById.get(cw.raceIds[0])
        const pt = race?.gpxPoints[cw.segmentIndex]
        if (!pt) return null
        const names = cw.raceIds
          .map((rid) => racesById.get(rid)?.name ?? '?')
          .join(' ↔ ')
        return { i, lat: pt.lat, lng: pt.lng, names, cw }
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
  }, [collisionWindows, racesById])

  return (
    <>
      <style>{`html[data-theme="dark"] .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }`}</style>
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

        {/* Heat / density / shared / runners drawn on one canvas (stable) */}
        <CanvasOverlay items={canvasItems} />

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

        {/* Collision markers (where two courses meet) */}
        {collisionMarkers.map((m) => {
          const hl = highlightedCollision === m.i
          const h = (s: number) => `${String(Math.floor(s / 3600)).padStart(2, '0')}h${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`
          return (
            <CircleMarker
              key={`coll-${m.i}`}
              center={[m.lat, m.lng]}
              radius={hl ? 13 : 8}
              pathOptions={{
                color: '#ffffff',
                fillColor: '#A78BFA',
                fillOpacity: hl ? 0.95 : 0.7,
                weight: hl ? 3 : 1.5,
              }}
            >
              <Tooltip>
                <span>
                  Rencontre : {m.names}
                  <br />
                  {h(m.cw.tStart)} → {h(m.cw.tEnd)} · jusqu&apos;à {Math.round(m.cw.peak)} coureurs
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
