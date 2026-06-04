'use client'

import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import type { GPXPoint, RiskMapEntry } from '@/engine/types'

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
}

function getRiskColor(score: number): string {
  if (score >= 0.8) return 'var(--color-danger, #DC2626)'
  if (score >= 0.5) return 'var(--color-warning, #D97706)'
  return 'var(--color-safe, #16A34A)'
}

export default function LeafletMap({ races, riskMap, visibleRaces, highlightedSegment }: LeafletMapProps) {
  // Compute center from first race with points
  const firstPoints = races.find((r) => r.gpxPoints.length > 0)?.gpxPoints
  const center: [number, number] = firstPoints
    ? [firstPoints[0].lat, firstPoints[0].lng]
    : [45.92, 6.87]

  return (
    <>
      <style>{`.leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(95%) contrast(90%); }`}</style>
      <MapContainer
        center={center}
        zoom={12}
        style={{ width: '100%', height: '100%', background: '#14110f' }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="© OpenStreetMap"
        />

        {/* Race polylines */}
        {races.map((race) => {
          if (!visibleRaces.has(race.id)) return null
          if (race.gpxPoints.length < 2) return null
          const positions: [number, number][] = race.gpxPoints.map((p) => [p.lat, p.lng])
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

        {/* Risk zone markers */}
        {riskMap.map((entry, i) => {
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
      </MapContainer>
    </>
  )
}
