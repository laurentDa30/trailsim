'use client'

import { useState } from 'react'
import { ChevronRightIcon, SlidersHorizontalIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Race, Simulation } from '@prisma/client'

const DEFAULT_ARCHETYPES = [
  {
    id: 'elite',
    label: 'Élite',
    color: '#7CB518',
    percentage: 5,
    speedMin: 12,
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
    speedMin: 9,
    speedMax: 12,
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
    speedMin: 7,
    speedMax: 9,
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
    speedMin: 5,
    speedMax: 7,
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
    speedMin: 3,
    speedMax: 5,
    fatiguePlancher: 40,
    techLevel: 25,
    ravito: 180,
    abandon: 15,
  },
]

type Archetype = typeof DEFAULT_ARCHETYPES[number]

interface RaceConfig {
  totalRunners: number
  archetypes: Archetype[]
}

interface Step2PelotonProps {
  eventId: string
  races: Race[]
  simulation: Simulation | null
  onUpdate: () => void
}

export function Step2Peloton({ races }: Step2PelotonProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [configs, setConfigs] = useState<Record<string, RaceConfig>>(() => {
    const init: Record<string, RaceConfig> = {}
    races.forEach((r) => {
      init[r.id] = {
        totalRunners: 100,
        archetypes: DEFAULT_ARCHETYPES.map((a) => ({ ...a })),
      }
    })
    return init
  })
  const [expandedArchetypes, setExpandedArchetypes] = useState<Record<string, boolean>>({})

  const activeRace = races[activeTab]
  const config = activeRace ? configs[activeRace.id] : null

  function updateConfig(raceId: string, updates: Partial<RaceConfig>) {
    setConfigs((prev) => ({
      ...prev,
      [raceId]: { ...prev[raceId], ...updates },
    }))
  }

  function updateArchetype(raceId: string, archId: string, updates: Partial<Archetype>) {
    setConfigs((prev) => {
      const cfg = prev[raceId]
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
    const cfg = configs[raceId]
    const total = cfg.archetypes.reduce((s, a) => s + a.percentage, 0)
    if (total === 0) return
    setConfigs((prev) => ({
      ...prev,
      [raceId]: {
        ...cfg,
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
      <div className="flex gap-1 border-b border-[var(--color-line)]">
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
                <span className="text-[var(--color-ink-4)] font-normal">
                  · {configs[race.id]?.totalRunners}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      {activeRace && config && (
        <div className="grid grid-cols-[1fr_240px] gap-6">
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
                          <td className="px-4 py-3 text-right text-[var(--color-ink-4)] tabular-nums">
                            {count}
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

          {/* Donut chart */}
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-4 flex flex-col items-center">
            <div className="flex items-center gap-1.5 mb-3 self-start">
              <SlidersHorizontalIcon size={13} className="text-[var(--color-ink-4)]" />
              <span className="text-xs font-medium text-[var(--color-ink-3)]">Distribution</span>
            </div>
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
            <div className="w-full space-y-1.5 mt-2">
              {config.archetypes.map((a) => (
                <div key={a.id} className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: a.color }} />
                    <span className="text-[var(--color-ink-3)]">{a.label}</span>
                  </span>
                  <span className="text-[var(--color-ink-4)] tabular-nums">{a.percentage}%</span>
                </div>
              ))}
            </div>
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
