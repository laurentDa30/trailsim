'use client'

import { useState } from 'react'
import { ChevronRightIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Race } from '@prisma/client'
import type { RunnerProfile } from '@/lib/validators/simulation'

export interface PelotonData {
  totalRunners: number
  profiles: RunnerProfile[]
}

export const DEFAULT_ARCHETYPES = [
  {
    id: 'elite',
    label: 'Élite',
    color: '#7CB518',
    percentage: 5,
    speedMin: 13,
    speedMax: 18,
    fatiguePlancher: 80,
    techLevel: 95,
    ravito: 30,
    abandon: 2,
  },
  {
    id: 'confirme',
    label: 'Confirmé',
    color: '#38BDF8',
    percentage: 20,
    speedMin: 10,
    speedMax: 13,
    fatiguePlancher: 70,
    techLevel: 75,
    ravito: 60,
    abandon: 5,
  },
  {
    id: 'intermediaire',
    label: 'Intermédiaire',
    color: '#FBBF24',
    percentage: 35,
    speedMin: 8,
    speedMax: 11,
    fatiguePlancher: 60,
    techLevel: 55,
    ravito: 90,
    abandon: 8,
  },
  {
    id: 'debutant',
    label: 'Débutant',
    color: '#F472B6',
    percentage: 30,
    speedMin: 6,
    speedMax: 8,
    fatiguePlancher: 50,
    techLevel: 40,
    ravito: 120,
    abandon: 12,
  },
  {
    id: 'marcheur',
    label: 'Marcheur',
    color: '#A78BFA',
    percentage: 10,
    speedMin: 4,
    speedMax: 6,
    fatiguePlancher: 40,
    techLevel: 25,
    ravito: 180,
    abandon: 15,
  },
]

export type Archetype = typeof DEFAULT_ARCHETYPES[number]

export interface RaceConfig {
  totalRunners: number
  archetypes: Archetype[]
}

export type PelotonConfigs = Record<string, RaceConfig>

interface SavedProfile {
  label: string
  color: string
  percentage: number
  baseSpeedMin: number
  baseSpeedMax: number
  fatigueFactor: number
  techSkill: number
  ravitoDuration: number
  abandonRate: number
}

/**
 * Build the initial per-race peloton config. Always keeps the full set of
 * archetypes (so e.g. "Marcheur" never disappears); when a saved simulation
 * exists, its percentages and physical params are merged in by label
 * (archetypes absent from the save — i.e. set to 0% — keep 0%).
 */
export function buildInitialConfigs(
  races: { id: string }[],
  savedProfiles?: SavedProfile[] | null
): PelotonConfigs {
  const base: Archetype[] = DEFAULT_ARCHETYPES.map((a) => ({ ...a }))
  if (savedProfiles && savedProfiles.length > 0) {
    const byLabel = new Map(savedProfiles.map((p) => [p.label, p]))
    base.forEach((a) => {
      const p = byLabel.get(a.label)
      if (p) {
        a.percentage = p.percentage
        a.speedMin = p.baseSpeedMin
        a.speedMax = p.baseSpeedMax
        a.fatiguePlancher = Math.round(p.fatigueFactor * 100)
        a.techLevel = Math.round(p.techSkill * 100)
        a.ravito = p.ravitoDuration
        a.abandon = Math.round(p.abandonRate * 100)
      } else {
        // Was at 0% in the saved simulation → keep the archetype but at 0%
        a.percentage = 0
      }
    })
    // Any saved profile that isn't a default archetype (custom) is appended
    savedProfiles.forEach((p, i) => {
      if (!base.some((a) => a.label === p.label)) {
        base.push({
          id: `saved-${i}`,
          label: p.label,
          color: p.color,
          percentage: p.percentage,
          speedMin: p.baseSpeedMin,
          speedMax: p.baseSpeedMax,
          fatiguePlancher: Math.round(p.fatigueFactor * 100),
          techLevel: Math.round(p.techSkill * 100),
          ravito: p.ravitoDuration,
          abandon: Math.round(p.abandonRate * 100),
        })
      }
    })
  }
  const init: PelotonConfigs = {}
  races.forEach((r) => {
    init[r.id] = { totalRunners: 100, archetypes: base.map((a) => ({ ...a })) }
  })
  return init
}

interface Step2PelotonProps {
  races: Race[]
  configs: PelotonConfigs
  setConfigs: React.Dispatch<React.SetStateAction<PelotonConfigs>>
}

export function archetypesToPeloton(configs: Record<string, RaceConfig>): PelotonData {
  const all = Object.values(configs)
  const totalRunners = all.reduce((s, c) => s + c.totalRunners, 0)
  // The Simulation model holds one profile set; use the first race's archetypes.
  const first = all[0]
  const profiles: RunnerProfile[] = (first?.archetypes ?? [])
    .filter((a) => a.percentage > 0)
    .map((a) => ({
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
  return { totalRunners: totalRunners || 100, profiles }
}

export function Step2Peloton({ races, configs, setConfigs }: Step2PelotonProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [expandedArchetypes, setExpandedArchetypes] = useState<Record<string, boolean>>({})

  const defaultConfig = (): RaceConfig => ({
    totalRunners: 100,
    archetypes: DEFAULT_ARCHETYPES.map((a) => ({ ...a })),
  })

  const activeRace = races[activeTab]
  const config = activeRace ? configs[activeRace.id] ?? defaultConfig() : null
  const totalAll = races.reduce((s, r) => s + (configs[r.id]?.totalRunners ?? 0), 0)

  function updateConfig(raceId: string, updates: Partial<RaceConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [raceId]: { ...(prev[raceId] ?? defaultConfig()), ...updates },
    }))
  }

  // Make this course a single-archetype peloton (100% this one, 0% the rest)
  function setOnlyArchetype(raceId: string, archId: string) {
    setConfigs((prev) => {
      const cfg = prev[raceId] ?? defaultConfig()
      return {
        ...prev,
        [raceId]: {
          ...cfg,
          archetypes: cfg.archetypes.map((a) => ({
            ...a,
            percentage: a.id === archId ? 100 : 0,
          })),
        },
      }
    })
  }

  function updateArchetype(raceId: string, archId: string, updates: Partial<Archetype>) {
    setConfigs((prev) => {
      const cfg = prev[raceId] ?? defaultConfig()
      return {
        ...prev,
        [raceId]: {
          ...cfg,
          archetypes: cfg.archetypes.map((a) =>
            a.id === archId ? { ...a, ...updates } : a
          ),
        },
      }
    })
  }

  function normalizeArchetypes(raceId: string) {
    const cfg = configs[raceId] ?? defaultConfig()
    const total = cfg.archetypes.reduce((s, a) => s + a.percentage, 0)
    if (total === 0) return
    setConfigs((prev) => ({
      ...prev,
      [raceId]: {
        ...(prev[raceId] ?? defaultConfig()),
        archetypes: cfg.archetypes.map((a) => ({
          ...a,
          percentage: Math.round((a.percentage / total) * 100),
        })),
      },
    }))
  }

  if (races.length === 0) {
    return (
      <div className="text-center py-16 text-[var(--color-ink-4)]">
        Aucune course configurée. Retournez à l&#39;étape 1.
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-ink)] mb-1">Configuration du Peloton</h2>
        <p className="text-sm text-[var(--color-ink-3)]">
          Définissez la répartition des coureurs par archétype pour chaque course.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-[var(--color-line)]">
        {races.map((race, i) => (
          <button
            key={race.id}
            onClick={() => setActiveTab(i)}
            className={cn(
              'px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              activeTab === i
                ? 'border-[var(--color-lime)] text-[var(--color-lime)]'
                : 'border-transparent text-[var(--color-ink-3)] hover:text-[var(--color-ink-2)]'
            )}
          >
            <span className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: race.color }}
              />
              {race.name}
              {config && (
                <span className="text-[var(--color-ink-4)] font-normal tabular-nums">
                  · {configs[race.id]?.totalRunners}
                </span>
              )}
            </span>
          </button>
        ))}
        <span className="ml-auto pr-1 text-sm text-[var(--color-ink-3)]">
          Total{' '}
          <b className="font-mono text-[var(--color-ink)] tabular-nums">{totalAll}</b> coureurs
        </span>
      </div>

      {activeRace && config && (
        <div className="grid grid-cols-[1fr_280px] gap-6">
          <div className="space-y-4">
            {/* Total runners */}
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-4">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-medium text-[var(--color-ink)]">
                  Nombre total de coureurs
                </label>
                <span className="text-2xl font-semibold text-[var(--color-lime)]">
                  {config.totalRunners}
                </span>
              </div>
              <input
                type="range"
                min={10}
                max={2000}
                step={10}
                value={config.totalRunners}
                onChange={(e) =>
                  updateConfig(activeRace.id, { totalRunners: parseInt(e.target.value) })
                }
                className="w-full h-2 rounded-full appearance-none cursor-pointer accent-[var(--color-lime)] bg-[var(--color-bg-2)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-ink-4)] mt-1">
                <span>10</span>
                <span>2000</span>
              </div>
            </div>

            {/* Archetype table */}
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-line)]">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">
                  Répartition des archétypes
                </h3>
                {(() => {
                  const total = config.archetypes.reduce((s, a) => s + a.percentage, 0)
                  const diff = 100 - total
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          'text-xs font-medium',
                          Math.abs(diff) < 1
                            ? 'text-[var(--color-safe)]'
                            : 'text-[var(--color-danger)]'
                        )}
                      >
                        {Math.abs(diff) < 1
                          ? 'Total: 100%'
                          : `Total: ${total}% — ajustez (${diff > 0 ? '+' : ''}${diff}%)`}
                      </span>
                      <button
                        onClick={() => normalizeArchetypes(activeRace.id)}
                        className="text-xs text-[var(--color-lime)] hover:underline"
                      >
                        Répartir à 100%
                      </button>
                    </div>
                  )
                })()}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--color-line)]">
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-ink-4)] w-8" />
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-ink-4)]">Archétype</th>
                    <th className="text-left px-4 py-2.5 text-xs font-medium text-[var(--color-ink-4)] w-40">Répartition</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--color-ink-4)] w-16">%</th>
                    <th className="text-right px-4 py-2.5 text-xs font-medium text-[var(--color-ink-4)] w-16">Nb</th>
                  </tr>
                </thead>
                <tbody>
                  {config.archetypes.map((arch) => {
                    const key = `${activeRace.id}-${arch.id}`
                    const expanded = expandedArchetypes[key]
                    const count = Math.round(config.totalRunners * arch.percentage / 100)

                    return (
                      <>
                        <tr
                          key={arch.id}
                          className="border-b border-[var(--color-line)] last:border-0 hover:bg-[var(--color-bg-2)] transition-colors"
                        >
                          <td className="px-4 py-3">
                            <button
                              onClick={() =>
                                setExpandedArchetypes((prev) => ({
                                  ...prev,
                                  [key]: !prev[key],
                                }))
                              }
                              className="text-[var(--color-ink-4)] hover:text-[var(--color-ink-2)] transition-colors"
                            >
                              <ChevronRightIcon
                                size={14}
                                className={cn('transition-transform', expanded && 'rotate-90')}
                              />
                            </button>
                          </td>
                          <td className="px-4 py-3">
                            <span className="flex items-center gap-2">
                              <span
                                className="w-2 h-2 rounded-full"
                                style={{ backgroundColor: arch.color }}
                              />
                              <span className="text-[var(--color-ink-2)]">{arch.label}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <input
                              type="range"
                              min={0}
                              max={100}
                              step={1}
                              value={arch.percentage}
                              onChange={(e) =>
                                updateArchetype(activeRace.id, arch.id, {
                                  percentage: parseInt(e.target.value),
                                })
                              }
                              className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-[var(--color-lime)]"
                              style={{
                                background: `linear-gradient(to right, ${arch.color} 0%, ${arch.color} ${arch.percentage}%, var(--color-bg-2) ${arch.percentage}%)`,
                              }}
                            />
                          </td>
                          <td className="px-4 py-3 text-right text-[var(--color-ink-2)] tabular-nums">
                            {arch.percentage}%
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums">
                            <div className="flex items-center justify-end gap-2">
                              <span className="text-[var(--color-ink-4)]">{count}</span>
                              <button
                                type="button"
                                onClick={() => setOnlyArchetype(activeRace.id, arch.id)}
                                title="Course 100% ce profil (met les autres à 0%)"
                                className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
                                style={{
                                  border: '1px solid var(--color-line)',
                                  color: 'var(--color-ink-3)',
                                  background: 'var(--color-bg-2)',
                                }}
                              >
                                100%
                              </button>
                            </div>
                          </td>
                        </tr>
                        {expanded && (
                          <tr key={`${arch.id}-expanded`} className="bg-[var(--color-bg-2)] border-b border-[var(--color-line)] last:border-0">
                            <td colSpan={5} className="px-6 py-4">
                              <div className="grid grid-cols-2 gap-x-8 gap-y-3">
                                <SliderRow
                                  label="Vitesse min (km/h)"
                                  value={arch.speedMin}
                                  min={2}
                                  max={18}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, { speedMin: v })
                                  }
                                  color={arch.color}
                                />
                                <SliderRow
                                  label="Vitesse max (km/h)"
                                  value={arch.speedMax}
                                  min={2}
                                  max={20}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, { speedMax: v })
                                  }
                                  color={arch.color}
                                />
                                <SliderRow
                                  label="Plancher fatigue (%)"
                                  value={arch.fatiguePlancher}
                                  min={30}
                                  max={100}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, {
                                      fatiguePlancher: v,
                                    })
                                  }
                                  color={arch.color}
                                />
                                <SliderRow
                                  label="Niveau technique (%)"
                                  value={arch.techLevel}
                                  min={0}
                                  max={100}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, { techLevel: v })
                                  }
                                  color={arch.color}
                                />
                                <SliderRow
                                  label="Arrêt ravito (s)"
                                  value={arch.ravito}
                                  min={0}
                                  max={300}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, { ravito: v })
                                  }
                                  color={arch.color}
                                />
                                <SliderRow
                                  label="Taux d'abandon (%)"
                                  value={arch.abandon}
                                  min={0}
                                  max={30}
                                  onChange={(v) =>
                                    updateArchetype(activeRace.id, arch.id, { abandon: v })
                                  }
                                  color={arch.color}
                                />
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Side summary */}
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-4 flex flex-col">
            <div className="flex items-center gap-1.5 mb-3">
              <SlidersHorizontalIcon size={13} className="text-[var(--color-ink-4)]" />
              <span className="text-xs font-semibold text-[var(--color-ink-2)]">
                {activeRace.name} · Répartition
              </span>
            </div>

            {/* Donut with centred runner count */}
            <div className="relative w-full" style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie
                    data={config.archetypes.filter((a) => a.percentage > 0)}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    dataKey="percentage"
                    nameKey="label"
                    strokeWidth={2}
                    stroke="var(--color-bg-1)"
                  >
                    {config.archetypes
                      .filter((a) => a.percentage > 0)
                      .map((a) => (
                        <Cell key={a.id} fill={a.color} />
                      ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--color-bg-2)',
                      border: '1px solid var(--color-line)',
                      borderRadius: '8px',
                      color: 'var(--color-ink)',
                      fontSize: '12px',
                    }}
                    formatter={(value, name) => [`${value}%`, name as string]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-mono text-2xl font-bold text-[var(--color-ink)] tabular-nums leading-none">
                  {config.totalRunners}
                </span>
                <span className="text-[10px] text-[var(--color-ink-3)] mt-0.5">coureurs</span>
              </div>
            </div>

            {/* Legend with count · pct */}
            <div className="w-full space-y-1.5 mt-2">
              {config.archetypes.map((a) => {
                const count = Math.round((config.totalRunners * a.percentage) / 100)
                return (
                  <div key={a.id} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                      <span className="text-[var(--color-ink-3)]">{a.label}</span>
                    </span>
                    <span className="text-[var(--color-ink-4)] tabular-nums font-mono">
                      {count} · {a.percentage}%
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Comparaison inter-courses */}
            <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
              <span className="text-xs font-semibold text-[var(--color-ink-2)]">Comparaison</span>
              <div className="mt-2.5 space-y-2.5">
                {races.map((r) => {
                  const rc = configs[r.id]
                  if (!rc) return null
                  const sum = rc.archetypes.reduce((s, a) => s + a.percentage, 0) || 1
                  return (
                    <div key={r.id}>
                      <div className="flex items-center justify-between mb-1 text-[11px]">
                        <span className="font-semibold" style={{ color: r.color }}>
                          {r.name}
                        </span>
                        <span className="font-mono text-[var(--color-ink-3)] tabular-nums">
                          {rc.totalRunners} crs
                        </span>
                      </div>
                      <div className="flex h-[5px] rounded-full overflow-hidden bg-[var(--color-bg-2)]">
                        {rc.archetypes.map((a) => (
                          <span
                            key={a.id}
                            style={{
                              flex: a.percentage / sum,
                              backgroundColor: a.color,
                              opacity: 0.85,
                            }}
                          />
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-ink-4)]">
              Cliquez ▸ pour éditer les paramètres physiques. Partagés entre toutes les courses.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

interface SliderRowProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  color: string
}

function SliderRow({ label, value, min, max, onChange, color }: SliderRowProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-[var(--color-ink-3)]">{label}</span>
        <span className="text-xs font-medium tabular-nums" style={{ color }}>
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} 0%, ${color} ${((value - min) / (max - min)) * 100}%, var(--color-bg-1) ${((value - min) / (max - min)) * 100}%)`,
        }}
      />
    </div>
  )
}
