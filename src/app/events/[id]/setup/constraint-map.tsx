'use client'

import { MapContainer, TileLayer, Polyline, Marker, Popup, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import { useEffect } from 'react'
import 'leaflet/dist/leaflet.css'
import type { GPXPoint } from '@/engine/types'
import { presetOf } from './constraint-presets'

export interface ConstraintMarker {
  id: string
  raceId: string
  lat: number
  lng: number
  type: string
}

interface ConstraintMapProps {
  races: { id: string; name: string; color: string; gpxPoints: GPXPoint[] }[]
  constraints: ConstraintMarker[]
  placingPreset: string | null
  onPlace: (raceId: string, indexStart: number, lat: number, lng: number) => void
  onRemove: (id: string) => void
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

function constraintIcon(letter: string, color: string): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="width:22px;height:22px;border-radius:6px;background:${color};border:2px solid #14110f;box-shadow:0 1px 4px rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:11px;font-weight:700;font-family:Inter,sans-serif">${letter}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  })
}

function ClickHandler({
  races,
  placingPreset,
  onPlace,
}: {
  races: ConstraintMapProps['races']
  placingPreset: string | null
  onPlace: ConstraintMapProps['onPlace']
}) {
  const map = useMapEvents({
    click(e) {
      if (!placingPreset) return
      // Snap to the nearest GPX point across all races (within ~120 m)
      let best: { raceId: string; index: number; lat: number; lng: number } | null = null
      let bestDist = 0.12 // km
      for (const r of races) {
        for (let i = 0; i < r.gpxPoints.length; i++) {
          const p = r.gpxPoints[i]
          const d = haversineKm(e.latlng.lat, e.latlng.lng, p.lat, p.lng)
          if (d < bestDist) {
            bestDist = d
            best = { raceId: r.id, index: i, lat: p.lat, lng: p.lng }
          }
        }
      }
      if (best) onPlace(best.raceId, best.index, best.lat, best.lng)
    },
  })
  useEffect(() => {
    const c = map.getContainer()
    c.style.cursor = placingPreset ? 'crosshair' : ''
    return () => {
      c.style.cursor = ''
    }
  }, [placingPreset, map])
  return null
}

export default function ConstraintMap({
  races,
  constraints,
  placingPreset,
  onPlace,
  onRemove,
}: ConstraintMapProps) {
  const first = races.find((r) => r.gpxPoints.length > 0)?.gpxPoints
  const center: [number, number] = first ? [first[0].lat, first[0].lng] : [45.92, 6.87]

  return (
    <>
      <style>{`.leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }`}</style>
      <MapContainer center={center} zoom={13} style={{ width: '100%', height: '100%', background: '#14110f' }} preferCanvas>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" />

        {races.map((r) =>
          r.gpxPoints.length > 1 ? (
            <Polyline
              key={r.id}
              positions={r.gpxPoints.map((p) => [p.lat, p.lng]) as [number, number][]}
              pathOptions={{ color: r.color, weight: 3, opacity: 0.85 }}
            />
          ) : null
        )}

        <ClickHandler races={races} placingPreset={placingPreset} onPlace={onPlace} />

        {constraints.map((c) => {
          const preset = presetOf(c.type)
          return (
            <Marker key={c.id} position={[c.lat, c.lng]} icon={constraintIcon(preset.letter, preset.color)}>
              <Popup>
                <div style={{ minWidth: 130 }}>
                  <div style={{ fontWeight: 700, marginBottom: 4, color: preset.color }}>{preset.label}</div>
                  <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>{preset.description}</div>
                  <button
                    onClick={() => onRemove(c.id)}
                    style={{
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
