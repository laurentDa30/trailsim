'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSimulation } from '@/hooks/use-simulation'
import type { RunnerProfile, SimConfig, GPXPoint } from '@/engine/types'

interface SimulateRunnerProps {
  event: { id: string; name: string; location?: string | null }
  simulation: {
    id: string
    name: string
    totalRunners: number
    temperature: number
    wind: number
    windDirection: number
    rain: boolean
    rainIntensity: number
    fog: boolean
    jamThreshold: number
    nRuns?: number
    peloton?: string | null
    runnerProfiles: RunnerProfile[]
  }
  races: {
    id: string
    name: string
    color: string
    gpxPoints: string
    startTime: number
    segments: { type: string; indexStart: number; width: number; techLevel: number }[]
  }[]
}

interface LogSource {
  totalRunners: number
  temperature: number
  wind: number
  rain: boolean
  fog: boolean
  jamThreshold: number
  nProfiles: number
  nRaces: number
  nConstraints: number
}

/** Build the simulation log from the real configuration (no hardcoded values). */
function buildLogLines(s: LogSource): string[] {
  const weather =
    `T+${s.temperature}°C · vent ${s.wind} km/h` +
    (s.rain ? ' · pluie' : '') +
    (s.fog ? ' · brouillard' : '')
  return [
    'Initialisation du moteur Monte-Carlo…',
    `Chargement de ${s.nProfiles} profil(s) coureur…`,
    `Analyse de ${s.nRaces} tracé(s) GPX…`,
    'Calcul des coefficients Minetti (pente)…',
    `Météo : ${weather}`,
    `Peloton : ${s.totalRunners.toLocaleString('fr-FR')} coureurs`,
    s.nConstraints > 0
      ? `${s.nConstraints} portion(s) sensible(s) prise(s) en compte`
      : 'Aucune portion sensible marquée',
    `Seuil de bouchon : ${s.jamThreshold} coureurs`,
    'Départs en vagues différées…',
    'Run 1/100…',
    'Accumulation des densités par tranche de 150 m…',
    'Run 25/100…',
    'Détection des bouchons (sections saturées)…',
    'Run 50/100…',
    s.nRaces > 1
      ? 'Analyse des rencontres inter-courses…'
      : 'Course unique — pas de rencontre inter-courses',
    'Run 75/100…',
    'Affinement des probabilités…',
    'Run 100/100…',
    'Finalisation de la carte de risque…',
    'Calcul terminé ✓',
  ]
}

export function SimulateRunner({ event, simulation, races }: SimulateRunnerProps) {
  const { state, run } = useSimulation()
  const logEndRef = useRef<HTMLDivElement>(null)
  const [resultSaved, setResultSaved] = useState(false)

  // Auto-scroll log
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [state.logs])

  // Build config and run on mount
  useEffect(() => {
    const profilesPerRace = simulation.runnerProfiles.length > 0
      ? simulation.runnerProfiles
      : [
          {
            id: 'default',
            label: 'Coureur',
            percentage: 100,
            baseSpeedMin: 7,
            baseSpeedMax: 10,
            climbCoeff: 0.9,
            descentCoeff: 1.0,
            fatigueFactor: 0.75,
            techSkill: 0.7,
            ravitoDuration: 180,
            abandonRate: 0.08,
            color: '#7CB518',
          } satisfies RunnerProfile,
        ]

    const runnersPerRace = Math.max(
      1,
      Math.round(simulation.totalRunners / Math.max(1, races.length))
    )

    // Per-race peloton config (effectif + archetype mix) saved from setup
    type ArchLite = {
      label: string
      color: string
      percentage: number
      speedMin: number
      speedMax: number
      fatiguePlancher: number
      techLevel: number
      ravito: number
      abandon: number
    }
    type RaceCfg = { totalRunners: number; archetypes: ArchLite[] }
    let pelotonByRace: Record<string, RaceCfg> = {}
    try {
      if (simulation.peloton) pelotonByRace = JSON.parse(simulation.peloton) as Record<string, RaceCfg>
    } catch {
      pelotonByRace = {}
    }
    const archToProfiles = (archs: ArchLite[]): RunnerProfile[] =>
      archs
        .filter((a) => a.percentage > 0)
        .map((a) => ({
          id: a.label,
          label: a.label,
          percentage: a.percentage,
          baseSpeedMin: a.speedMin,
          baseSpeedMax: a.speedMax,
          climbCoeff: 1.0,
          descentCoeff: 1.0,
          fatigueFactor: a.fatiguePlancher / 100,
          techSkill: a.techLevel / 100,
          ravitoDuration: a.ravito,
          abandonRate: a.abandon / 100,
          color: a.color,
        }))

    const config: SimConfig = {
      simulationId: simulation.id,
      races: races.map((r) => {
        const gpxPoints: GPXPoint[] = (() => {
          try {
            return JSON.parse(r.gpxPoints) as GPXPoint[]
          } catch {
            return []
          }
        })()
        // This race's own profiles + effectif when available
        const rc = pelotonByRace[r.id]
        let raceProfiles = rc?.archetypes ? archToProfiles(rc.archetypes) : []
        if (raceProfiles.length === 0) raceProfiles = profilesPerRace
        const raceTotal = rc?.totalRunners ?? runnersPerRace
        return {
          id: r.id,
          name: r.name,
          color: r.color,
          // startTime is stored in minutes (T+30 min); the engine works in seconds.
          startOffset: r.startTime * 60,
          totalRunners: raceTotal,
          gpxPoints,
          profiles: raceProfiles,
          // Narrow/technical sections become engine constraints (ravitos excluded)
          constraints: r.segments
            .filter((s) => s.type !== 'RAVITO')
            .map((s) => ({
              dist: gpxPoints[s.indexStart]?.dist ?? 0,
              widthRatio: s.width,
              techLevel: s.techLevel,
              influenceKm: 0.2,
            })),
          // Placed ravito points → positions as fractions of the race
          ravitos: (() => {
            const total = gpxPoints.length > 0 ? gpxPoints[gpxPoints.length - 1].dist : 0
            if (total <= 0) return [] as number[]
            return r.segments
              .filter((s) => s.type === 'RAVITO')
              .map((s) => (gpxPoints[s.indexStart]?.dist ?? 0) / total)
              .filter((f) => f > 0 && f < 1)
              .sort((a, b) => a - b)
          })(),
        }
      }),
      weather: {
        temperature: simulation.temperature,
        wind: simulation.wind,
        windDirection: simulation.windDirection,
        // DB stores rainIntensity as 0–100; the engine expects 0–1.
        rainIntensity: simulation.rain ? simulation.rainIntensity / 100 : 0,
        rain: simulation.rain,
        fog: simulation.fog,
      },
      stepSeconds: 60,
      nRuns: simulation.nRuns && simulation.nRuns > 0 ? simulation.nRuns : 100,
      jamThreshold: simulation.jamThreshold,
    }

    const logLines = buildLogLines({
      totalRunners: simulation.totalRunners,
      temperature: simulation.temperature,
      wind: simulation.wind,
      rain: simulation.rain,
      fog: simulation.fog,
      jamThreshold: simulation.jamThreshold,
      nProfiles: simulation.runnerProfiles.length,
      nRaces: races.length,
      nConstraints: races.reduce(
        (sum, r) => sum + r.segments.filter((s) => s.type !== 'RAVITO').length,
        0
      ),
    })

    run(config, logLines)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Save result when done
  useEffect(() => {
    if (state.status === 'done' && state.result && !resultSaved) {
      setResultSaved(true)
      fetch(`/api/simulations/${simulation.id}/result`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultSnapshot: state.result,
        }),
      }).catch(() => {
        // silently ignore
      })
    }
  }, [state.status]) // eslint-disable-line react-hooks/exhaustive-deps

  const isDone = state.status === 'done'
  const isRunning = state.status === 'running'

  // Ring math — large circle r=85, cx=100, cy=100
  const RING_R = 85
  const circumference = 2 * Math.PI * RING_R
  const dashOffset = circumference - (state.progress / 100) * circumference

  function formatTimeRemaining(s: number): string {
    if (s <= 0) return '—'
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Topbar */}
      <header
        className="flex items-center gap-3 px-6 shrink-0"
        style={{
          height: 52,
          background: 'var(--color-bg-1)',
          borderBottom: '1px solid var(--color-line)',
        }}
      >
        {/* Brand logo — polyline altimetry icon */}
        <svg width={22} height={22} viewBox="0 0 22 22" fill="none">
          <polyline
            points="2,18 6,10 10,14 14,5 18,9 20,7"
            stroke="var(--color-lime)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <span className="font-semibold text-sm" style={{ color: 'var(--color-ink)' }}>
          TrailSim
        </span>

        <span
          className="w-px h-4 shrink-0"
          style={{ background: 'var(--color-line)' }}
        />

        <span className="text-sm truncate" style={{ color: 'var(--color-ink-3)' }}>
          {event.name}
        </span>
      </header>

      {/* Body */}
      <main className="flex-1 flex flex-col items-center px-6 py-10">
        <div className="w-full max-w-4xl space-y-8">

          {/* Title */}
          <div className="space-y-1">
            <h1
              className="text-2xl font-bold"
              style={{ color: 'var(--color-ink)' }}
            >
              Simulation Monte-Carlo
            </h1>
            <p
              className="text-sm font-mono"
              style={{ color: 'var(--color-ink-3)' }}
            >
              {event.name}
            </p>
          </div>

          {/* Two-column layout */}
          <div className="flex gap-8 items-start">
            {/* Left — ring + stats */}
            <div className="shrink-0 flex flex-col items-center gap-5" style={{ width: 220 }}>
              {/* Ring SVG */}
              <div className="relative">
                <svg
                  width={200}
                  height={200}
                  viewBox="0 0 200 200"
                  style={{ transform: 'rotate(-90deg)' }}
                >
                  {/* Track circle */}
                  <circle
                    cx={100}
                    cy={100}
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-bg-2)"
                    strokeWidth={14}
                  />
                  {/* Progress circle */}
                  <circle
                    cx={100}
                    cy={100}
                    r={RING_R}
                    fill="none"
                    stroke="var(--color-lime)"
                    strokeWidth={14}
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={isDone ? 0 : dashOffset}
                    className="transition-all duration-300"
                  />
                </svg>

                {/* Center content */}
                <div
                  className="absolute inset-0 flex flex-col items-center justify-center"
                  style={{ transform: 'none' }}
                >
                  {isDone ? (
                    <div className="flex flex-col items-center gap-1">
                      <span
                        className="text-sm font-semibold px-3 py-1 rounded-full"
                        style={{
                          background: 'color-mix(in srgb, var(--color-lime) 15%, transparent)',
                          color: 'var(--color-lime)',
                        }}
                      >
                        Terminé
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        Simulation
                      </span>
                      <span
                        className="font-bold tabular-nums leading-none"
                        style={{
                          fontSize: 30,
                          fontFamily: "'JetBrains Mono', 'Courier New', monospace",
                          color: 'var(--color-ink)',
                        }}
                      >
                        {state.currentRun}
                        <span style={{ fontSize: 16, color: 'var(--color-ink-4)' }}>
                          {' '}/ {state.totalRuns}
                        </span>
                      </span>
                      <span
                        className="text-[10px] tabular-nums"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        runs Monte-Carlo
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Stats rows */}
              <div
                className="w-full rounded-xl divide-y divide-[var(--color-line)] text-sm"
                style={{
                  border: '1px solid var(--color-line)',
                  background: 'var(--color-bg-1)',
                }}
              >
                <StatRow label="Coureurs simulés" value={String(state.runnersSimulated)} />
                <StatRow label="Zones détectées" value={String(state.zonesDetected)} />
                <StatRow
                  label="Convergence"
                  value={`${state.precision}%`}
                  highlight={isDone}
                />
                <StatRow
                  label={isDone ? 'Durée' : 'Temps restant'}
                  value={isDone ? 'Terminé' : formatTimeRemaining(state.estimatedSecondsLeft)}
                />
              </div>
            </div>

            {/* Right — map + log */}
            <div className="flex-1 min-w-0 space-y-5">
              {/* Map section */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-ink-4)' }}
                >
                  Courses analysées
                </p>
                <div
                  className="rounded-lg aspect-video relative overflow-hidden"
                  style={{
                    border: '1px solid var(--color-line)',
                    background: 'var(--color-bg-2)',
                  }}
                >
                  {/* Fake mini-map grid */}
                  <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 400 225"
                    preserveAspectRatio="xMidYMid slice"
                    className="absolute inset-0"
                  >
                    <defs>
                      <pattern id="mini-grid" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
                        <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--color-line)" strokeWidth="0.4" opacity="0.5" />
                      </pattern>
                    </defs>
                    <rect width="400" height="225" fill="url(#mini-grid)" />

                    {/* Simulated course lines */}
                    <path
                      d="M 30 200 Q 80 160 130 120 Q 180 80 220 60 Q 260 40 300 55 Q 340 70 370 100"
                      fill="none"
                      stroke="var(--color-lime)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                    <path
                      d="M 30 200 Q 70 170 110 150 Q 150 130 190 120 Q 230 110 260 125 Q 290 140 310 160"
                      fill="none"
                      stroke="#38BDF8"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      opacity="0.6"
                    />
                  </svg>

                  {/* Race dots */}
                  <div className="absolute bottom-3 left-3 flex flex-col gap-1.5">
                    {races.map((r) => (
                      <div key={r.id} className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ background: r.color }}
                        />
                        <span
                          className="text-xs"
                          style={{ color: 'var(--color-ink-3)' }}
                        >
                          {r.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Log section */}
              <div>
                <p
                  className="text-xs font-semibold uppercase tracking-wider mb-2"
                  style={{ color: 'var(--color-ink-4)' }}
                >
                  Journal
                </p>
                <div
                  className="rounded-lg overflow-hidden"
                  style={{ border: '1px solid var(--color-line)' }}
                >
                  <div
                    className="h-44 overflow-y-auto p-3 space-y-0.5"
                    style={{ background: '#111009' }}
                  >
                    {state.logs.map((line, i) => (
                      <div
                        key={i}
                        className="flex gap-2 leading-relaxed"
                        style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                      >
                        <span
                          className="shrink-0 tabular-nums select-none"
                          style={{ color: '#3a3830' }}
                        >
                          {String(i + 1).padStart(3, '0')}
                        </span>
                        <span
                          style={{
                            color: line.includes('✓') || line.includes('terminé')
                              ? '#4ade80'
                              : line.includes('bouchon') || line.includes('rencontre') || line.includes('sensible')
                                ? '#fbbf24'
                                : '#6b6861',
                          }}
                        >
                          {line}
                        </span>
                      </div>
                    ))}
                    {isRunning && (
                      <div
                        className="flex gap-2"
                        style={{ fontSize: 11.5, fontFamily: "'JetBrains Mono', 'Courier New', monospace" }}
                      >
                        <span style={{ color: '#3a3830' }}>···</span>
                        <span
                          className="animate-pulse"
                          style={{ color: 'var(--color-lime)' }}
                        >
                          _
                        </span>
                      </div>
                    )}
                    <div ref={logEndRef} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar row */}
          <div className="space-y-1.5">
            <div
              className="w-full rounded-full overflow-hidden"
              style={{ height: 5, background: 'var(--color-bg-2)' }}
            >
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${isDone ? 100 : state.progress}%`,
                  background: 'var(--color-lime)',
                }}
              />
            </div>
            <div className="flex justify-between items-center">
              <span
                className="text-xs tabular-nums"
                style={{ color: 'var(--color-ink-4)' }}
              >
                {isDone ? 100 : state.progress}%
              </span>
              <span
                className="text-xs"
                style={{ color: 'var(--color-ink-4)' }}
              >
                {isDone
                  ? `${state.runnersSimulated} coureurs · ${state.zonesDetected} zones`
                  : isRunning
                    ? 'Simulation en cours...'
                    : ''}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-center gap-4">
            {isRunning && (
              <Button variant="ghost" disabled>
                Annuler
              </Button>
            )}
            {isDone && (
              <Button variant="primary" asChild>
                <Link href={`/events/${event.id}/results/${simulation.id}`}>
                  Voir les résultats →
                </Link>
              </Button>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string
  value: string
  highlight?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <span
        className={cn('text-xs', highlight ? '' : '')}
        style={{ color: 'var(--color-ink-4)' }}
      >
        {label}
      </span>
      <span
        className="text-sm font-semibold tabular-nums"
        style={{ color: highlight ? 'var(--color-lime)' : 'var(--color-ink)' }}
      >
        {value}
      </span>
    </div>
  )
}
