'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  FileTextIcon,
  MapIcon,
  AlertTriangleIcon,
  ZapIcon,
  UsersIcon,
  EyeIcon,
  EyeOffIcon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RiskBadge } from '@/components/layout/risk-badge'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'

const LeafletMap = dynamic(() => import('./leaflet-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'var(--color-bg)' }} />,
})

export interface ResultsViewProps {
  event: { id: string; name: string; location?: string | null; date?: Date | null }
  simulation: {
    id: string
    name: string
    totalRunners: number
    temperature: number
    wind: number
    rain: boolean
    fog: boolean
  }
  result: CompressedSimulationResult | null
  races: {
    id: string
    name: string
    color: string
    distance: number
    elevGain: number
    gpxPoints: GPXPoint[]
  }[]
  runnerProfiles: { id: string; label: string; color: string; percentage: number }[]
}

function formatTimeHHMM(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}h${String(m).padStart(2, '0')}`
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div
      className="flex items-center gap-2 px-4 py-2.5 border-b"
      style={{
        borderColor: 'var(--color-line)',
        background: 'var(--color-bg)',
      }}
    >
      <span style={{ color: 'var(--color-lime)' }}>{icon}</span>
      <span
        className="text-xs font-semibold uppercase tracking-widest"
        style={{ color: 'var(--color-ink-3)' }}
      >
        {label}
      </span>
    </div>
  )
}

export function ResultsView({
  event,
  simulation,
  result,
  races,
  runnerProfiles,
}: ResultsViewProps) {
  const [visibleRaces, setVisibleRaces] = useState<Set<string>>(
    () => new Set(races.map((r) => r.id))
  )
  const [highlightedSegment, setHighlightedSegment] = useState<{
    raceId: string
    segmentIndex: number
  } | null>(null)

  const toggleRace = useCallback((raceId: string) => {
    setVisibleRaces((prev) => {
      const next = new Set(prev)
      if (next.has(raceId)) {
        next.delete(raceId)
      } else {
        next.add(raceId)
      }
      return next
    })
  }, [])

  const riskMap = result?.riskMap ?? []
  const collisionWindows = result?.collisionWindows ?? []

  // Sort risk entries by score descending
  const sortedRiskMap = [...riskMap].sort((a, b) => b.riskScore - a.riskScore)

  return (
    <div
      className="flex flex-col"
      style={{
        height: '100vh',
        background: 'var(--color-bg)',
        color: 'var(--color-ink)',
        '--color-bg': '#14110f',
        '--color-bg-1': '#1a1714',
        '--color-bg-2': '#222019',
        '--color-line': '#2a2824',
        '--color-ink': '#f5f4f0',
        '--color-ink-2': '#c8c4bc',
        '--color-ink-3': '#8a8680',
        '--color-ink-4': '#555250',
        '--color-lime': '#7CB518',
        '--color-danger': '#DC2626',
        '--color-warning': '#D97706',
        '--color-safe': '#16A34A',
      } as React.CSSProperties}
    >
      {/* Topbar */}
      <header
        className="flex items-center gap-4 px-5 border-b shrink-0"
        style={{
          height: 52,
          background: 'var(--color-bg-1)',
          borderColor: 'var(--color-line)',
        }}
      >
        {/* Brand */}
        <div className="flex items-center gap-2 mr-2">
          <ZapIcon size={16} style={{ color: 'var(--color-lime)' }} />
          <span
            className="text-sm font-bold tracking-tight"
            style={{ color: 'var(--color-ink)' }}
          >
            TrailSim
          </span>
        </div>

        <span
          className="text-sm font-medium truncate max-w-[220px]"
          style={{ color: 'var(--color-ink-2)' }}
        >
          {event.name}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <Link href={`/events/${event.id}/setup`}>
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeftIcon size={13} />
              Configuration
            </Button>
          </Link>

          <Link href={`/events/${event.id}/report/${simulation.id}`}>
            <Button variant="primary" size="sm" className="gap-1.5">
              <FileTextIcon size={13} />
              Export PDF
            </Button>
          </Link>
        </div>
      </header>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        {/* Map area */}
        <div className="flex-1 relative">
          <LeafletMap
            races={races}
            riskMap={riskMap}
            visibleRaces={visibleRaces}
            highlightedSegment={highlightedSegment}
          />
        </div>

        {/* Right panel */}
        <aside
          className="shrink-0 overflow-y-auto border-l flex flex-col"
          style={{
            width: 340,
            background: 'var(--color-bg-1)',
            borderColor: 'var(--color-line)',
          }}
        >
          {/* COURSES section */}
          <div>
            <SectionHeader icon={<MapIcon size={12} />} label="Courses" />
            <div className="p-3 flex flex-col gap-1">
              {races.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune course configurée.
                </p>
              )}
              {races.map((race) => {
                const isVisible = visibleRaces.has(race.id)
                return (
                  <button
                    key={race.id}
                    onClick={() => toggleRace(race.id)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg w-full text-left transition-colors"
                    style={{
                      background: isVisible
                        ? 'var(--color-bg-2)'
                        : 'transparent',
                      border: '1px solid',
                      borderColor: isVisible ? 'var(--color-line)' : 'transparent',
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: race.color, opacity: isVisible ? 1 : 0.35 }}
                    />
                    <span
                      className="flex-1 text-sm font-medium truncate"
                      style={{
                        color: isVisible ? 'var(--color-ink)' : 'var(--color-ink-4)',
                      }}
                    >
                      {race.name}
                    </span>
                    <span
                      className="text-xs px-1.5 py-0.5 rounded font-mono"
                      style={{
                        background: 'var(--color-bg)',
                        color: 'var(--color-ink-3)',
                      }}
                    >
                      {race.distance.toFixed(1)} km
                    </span>
                    <span style={{ color: 'var(--color-ink-4)' }}>
                      {isVisible ? <EyeIcon size={13} /> : <EyeOffIcon size={13} />}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* ZONES À RISQUE section */}
          <div>
            <SectionHeader icon={<AlertTriangleIcon size={12} />} label="Zones à risque" />
            <div className="p-3 flex flex-col gap-1">
              {sortedRiskMap.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune zone à risque détectée.
                </p>
              )}
              {sortedRiskMap.slice(0, 20).map((entry, i) => {
                const race = races.find((r) => r.id === entry.raceId)
                const point = race?.gpxPoints[entry.segmentIndex]
                const dist = point?.dist ?? 0
                const isHL =
                  highlightedSegment?.raceId === entry.raceId &&
                  highlightedSegment?.segmentIndex === entry.segmentIndex

                return (
                  <button
                    key={i}
                    onClick={() =>
                      setHighlightedSegment(
                        isHL ? null : { raceId: entry.raceId, segmentIndex: entry.segmentIndex }
                      )
                    }
                    className="flex items-center gap-3 px-3 py-2 rounded-lg w-full text-left transition-colors"
                    style={{
                      background: isHL ? 'var(--color-bg-2)' : 'transparent',
                      border: '1px solid',
                      borderColor: isHL ? 'var(--color-line)' : 'transparent',
                    }}
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background:
                          entry.riskScore >= 0.8
                            ? 'var(--color-danger)'
                            : entry.riskScore >= 0.5
                              ? 'var(--color-warning)'
                              : 'var(--color-safe)',
                      }}
                    />
                    <span className="flex-1 text-xs" style={{ color: 'var(--color-ink-3)' }}>
                      {race?.name ?? entry.raceId}
                      <span
                        className="ml-1.5 font-mono"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        km {dist.toFixed(1)}
                      </span>
                    </span>
                    <RiskBadge score={Math.round(entry.riskScore * 100)} />
                  </button>
                )
              })}
            </div>
          </div>

          {/* COLLISIONS section */}
          <div>
            <SectionHeader icon={<ZapIcon size={12} />} label="Collisions" />
            <div className="p-3 flex flex-col gap-1">
              {collisionWindows.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucune fenêtre de collision détectée.
                </p>
              )}
              {collisionWindows.map((cw, i) => {
                const raceNames = cw.raceIds
                  .map((rid) => races.find((r) => r.id === rid)?.name ?? rid)
                  .join(' × ')
                return (
                  <div
                    key={i}
                    className="flex flex-col gap-1 px-3 py-2.5 rounded-lg"
                    style={{
                      background: 'var(--color-bg-2)',
                      border: '1px solid var(--color-line)',
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink-2)' }}>
                        {raceNames}
                      </span>
                      <span
                        className="text-xs font-mono ml-2 shrink-0"
                        style={{
                          color: cw.peak >= 0.8 ? 'var(--color-danger)' : 'var(--color-warning)',
                        }}
                      >
                        pic {Math.round(cw.peak * 100)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-3)' }}>
                        {formatTimeHHMM(cw.tStart)}
                      </span>
                      <span style={{ color: 'var(--color-ink-4)' }}>→</span>
                      <span className="text-xs font-mono" style={{ color: 'var(--color-ink-3)' }}>
                        {formatTimeHHMM(cw.tEnd)}
                      </span>
                      <span
                        className="ml-auto text-xs font-mono"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        seg {cw.segmentIndex}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* PROFILS section */}
          <div>
            <SectionHeader icon={<UsersIcon size={12} />} label="Profils" />
            <div className="p-3 flex flex-col gap-2">
              {runnerProfiles.length === 0 && (
                <p className="text-xs px-1 py-2" style={{ color: 'var(--color-ink-4)' }}>
                  Aucun profil configuré.
                </p>
              )}
              {runnerProfiles.map((profile) => (
                <div key={profile.id} className="flex flex-col gap-1.5 px-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: profile.color }}
                    />
                    <span
                      className="flex-1 text-sm truncate"
                      style={{ color: 'var(--color-ink-2)' }}
                    >
                      {profile.label}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--color-ink-3)' }}
                    >
                      {profile.percentage.toFixed(0)}%
                    </span>
                  </div>
                  {/* Percentage bar */}
                  <div
                    className="h-1 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-bg-2)' }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(profile.percentage, 100)}%`,
                        background: profile.color,
                        opacity: 0.8,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom spacer */}
          <div className="flex-1" />

          {/* Simulation meta */}
          <div
            className="px-4 py-3 border-t text-xs"
            style={{ borderColor: 'var(--color-line)', color: 'var(--color-ink-4)' }}
          >
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <span>{simulation.totalRunners} coureurs</span>
              <span>{simulation.temperature}°C</span>
              <span>Vent {simulation.wind} km/h</span>
              {simulation.rain && <span style={{ color: 'var(--color-warning)' }}>Pluie</span>}
              {simulation.fog && <span style={{ color: 'var(--color-warning)' }}>Brouillard</span>}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
