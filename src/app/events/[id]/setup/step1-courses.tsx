'use client'

import { useState, useRef } from 'react'
import {
  UploadIcon,
  PlusIcon,
  FileIcon,
  MapPinIcon,
  TrendingUpIcon,
  LoaderIcon,
  CheckIcon,
  Trash2Icon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import type { Race } from '@prisma/client'

const COLOR_SWATCHES = [
  '#7CB518',
  '#38BDF8',
  '#F472B6',
  '#FBBF24',
  '#A78BFA',
  '#FB7185',
  '#34D399',
  '#F97316',
]

const START_TIMES = [
  { label: 'T0', value: 0 },
  { label: 'T+30 min', value: 30 },
  { label: 'T+60 min', value: 60 },
  { label: 'T+90 min', value: 90 },
  { label: 'T+2h', value: 120 },
]

interface GpxState {
  status: 'idle' | 'uploading' | 'done' | 'error'
  stats?: { distance: number; elevGain: number; elevLoss: number; pointCount: number }
  error?: string
}

export interface Resources {
  effectif: number
  barrieres: number
}

interface Step1CoursesProps {
  eventId: string
  races: Race[]
  onUpdate: (races: Race[]) => void
  resources: Resources
  onResourcesChange: (r: Resources) => void
}

export function Step1Courses({
  eventId,
  races,
  onUpdate,
  resources,
  onResourcesChange,
}: Step1CoursesProps) {
  const [localRaces, setLocalRaces] = useState<Race[]>(races)
  // Reflect already-imported GPX tracks (so returning to this step keeps the "imported" state).
  const [gpxStates, setGpxStates] = useState<Record<string, GpxState>>(() => {
    const init: Record<string, GpxState> = {}
    races.forEach((r) => {
      if (r.gpxPoints && r.gpxPoints !== '[]') {
        let pointCount = 0
        try {
          pointCount = (JSON.parse(r.gpxPoints) as unknown[]).length
        } catch {
          pointCount = 0
        }
        init[r.id] = {
          status: 'done',
          stats: { distance: r.distance, elevGain: r.elevGain, elevLoss: r.elevLoss, pointCount },
        }
      }
    })
    return init
  })
  const effectif = resources.effectif
  const barrieres = resources.barrieres
  const setEffectif = (v: number) => onResourcesChange({ ...resources, effectif: v })
  const setBarrieres = (v: number) => onResourcesChange({ ...resources, barrieres: v })
  const [adding, setAdding] = useState(false)
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  // Persist race scalar fields to the DB. `name` is debounced (typed), while
  // discrete picks (color, startTime) are persisted immediately so they are
  // committed before the user launches the simulation.
  function persistRace(
    id: string,
    patch: Partial<Pick<Race, 'name' | 'color' | 'startTime'>>,
    immediate = false
  ) {
    const send = () =>
      fetch(`/api/events/${eventId}/races/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(() => {
        // UI state is source of truth; ignore transient errors
      })
    clearTimeout(saveTimers.current[id])
    if (immediate) {
      send()
    } else {
      saveTimers.current[id] = setTimeout(send, 350)
    }
  }

  function updateRace(id: string, updates: Partial<Race>) {
    const updated = localRaces.map((r) => (r.id === id ? { ...r, ...updates } : r))
    setLocalRaces(updated)
    onUpdate(updated)

    // Only persist the editable scalar fields
    const persistable: Partial<Pick<Race, 'name' | 'color' | 'startTime'>> = {}
    if (updates.name !== undefined) persistable.name = updates.name
    if (updates.color !== undefined) persistable.color = updates.color
    if (updates.startTime !== undefined) persistable.startTime = updates.startTime
    if (Object.keys(persistable).length > 0) {
      // color / startTime are discrete clicks → persist immediately; name is debounced
      const immediate = updates.name === undefined
      persistRace(id, persistable, immediate)
    }
  }

  async function handleAddRace() {
    setAdding(true)
    try {
      const res = await fetch(`/api/events/${eventId}/races`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: `Course ${localRaces.length + 1}` }),
      })
      if (res.ok) {
        const race = await res.json() as Race
        const updated = [...localRaces, race]
        setLocalRaces(updated)
        onUpdate(updated)
      }
    } finally {
      setAdding(false)
    }
  }

  async function handleDeleteRace(raceId: string) {
    if (!confirm('Supprimer cette course et son tracé ?')) return
    const updated = localRaces.filter((r) => r.id !== raceId)
    setLocalRaces(updated)
    onUpdate(updated)
    try {
      await fetch(`/api/events/${eventId}/races/${raceId}`, { method: 'DELETE' })
    } catch {
      /* ignore */
    }
  }

  async function handleGpxUpload(raceId: string, file: File) {
    setGpxStates((s) => ({ ...s, [raceId]: { status: 'uploading' } }))
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/api/events/${eventId}/races/${raceId}/gpx`, {
        method: 'POST',
        body: fd,
      })
      if (res.ok) {
        const { gpxPoints, ...stats } = (await res.json()) as {
          distance: number
          elevGain: number
          elevLoss: number
          pointCount: number
          gpxPoints?: string
        }
        setGpxStates((s) => ({ ...s, [raceId]: { status: 'done', stats } }))
        updateRace(raceId, {
          distance: stats.distance,
          elevGain: stats.elevGain,
          elevLoss: stats.elevLoss,
          // Carry the parsed track into client state so the constraints map
          // (step 4) shows it immediately, without a page reload.
          ...(gpxPoints ? { gpxPoints } : {}),
        })
      } else {
        setGpxStates((s) => ({ ...s, [raceId]: { status: 'error', error: 'Erreur upload' } }))
      }
    } catch {
      setGpxStates((s) => ({ ...s, [raceId]: { status: 'error', error: 'Erreur réseau' } }))
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-[var(--color-ink)] mb-1">Courses et tracés</h2>
        <p className="text-sm text-[var(--color-ink-3)]">
          Importez un fichier GPX par course. La distance, le D+ et le D− sont calculés
          automatiquement. Définissez la couleur et l&apos;heure de départ (offset depuis T0 de
          l&apos;événement).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {localRaces.map((race) => {
          const gpx = gpxStates[race.id]
          return (
            <div
              key={race.id}
              className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-5 space-y-4"
            >
              {/* Race name + color */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={race.name}
                    onChange={(e) => updateRace(race.id, { name: e.target.value })}
                    className="w-full bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-lg px-3 py-2 text-[var(--color-ink)] text-sm focus:outline-none focus:border-[var(--color-lime)] transition-colors"
                    placeholder="Nom de la course"
                  />
                </div>

                {/* Color swatches */}
                <div className="flex gap-1 shrink-0">
                  {COLOR_SWATCHES.map((color) => (
                    <button
                      key={color}
                      onClick={() => updateRace(race.id, { color })}
                      className={cn(
                        'w-6 h-6 rounded-full transition-transform hover:scale-110',
                        race.color === color && 'ring-2 ring-white ring-offset-2 ring-offset-[var(--color-bg-1)] scale-110'
                      )}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>

                {/* Delete course */}
                <button
                  onClick={() => handleDeleteRace(race.id)}
                  className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-[var(--color-ink-4)] hover:text-[var(--color-danger)] hover:bg-[var(--color-bg-2)] transition-colors"
                  title="Supprimer la course"
                  aria-label="Supprimer la course"
                >
                  <Trash2Icon size={15} />
                </button>
              </div>

              {/* Start time + badges */}
              <div className="flex items-center gap-4 flex-wrap">
                {/* Start time */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--color-ink-3)]">Départ</span>
                  <div className="flex gap-1">
                    {START_TIMES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() => updateRace(race.id, { startTime: t.value })}
                        className={cn(
                          'px-2.5 py-1 rounded-md text-xs transition-colors',
                          race.startTime === t.value
                            ? 'bg-[var(--color-lime)] text-[#ffffff] font-medium'
                            : 'bg-[var(--color-bg-2)] border border-[var(--color-line)] text-[var(--color-ink-3)] hover:text-[var(--color-ink)]'
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Distance + D+ badges */}
                <div className="flex items-center gap-2 ml-auto">
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-line)] text-xs text-[var(--color-ink-2)]">
                    <MapPinIcon size={11} />
                    {race.distance > 0 ? `${race.distance} km` : '— km'}
                  </span>
                  <span className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[var(--color-bg-2)] border border-[var(--color-line)] text-xs text-[var(--color-ink-2)]">
                    <TrendingUpIcon size={11} />
                    {race.elevGain > 0 ? `+${race.elevGain} m` : '— m'}
                  </span>
                </div>
              </div>

              {/* GPX upload */}
              <div>
                {gpx?.status === 'done' ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-[color-mix(in_srgb,var(--color-safe)_10%,transparent)] border border-[color-mix(in_srgb,var(--color-safe)_30%,transparent)]">
                    <CheckIcon size={16} className="text-[var(--color-safe)] shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[var(--color-safe)] font-medium">GPX importé</p>
                      <p className="text-xs text-[var(--color-ink-3)] mt-0.5">
                        {gpx.stats?.distance} km · +{gpx.stats?.elevGain} m · {gpx.stats?.pointCount} points
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setGpxStates((s) => ({ ...s, [race.id]: { status: 'idle' } }))
                        if (fileRefs.current[race.id]) fileRefs.current[race.id]!.value = ''
                      }}
                      className="text-xs text-[var(--color-ink-4)] hover:text-[var(--color-ink-2)] transition-colors"
                    >
                      Remplacer
                    </button>
                  </div>
                ) : (
                  <label
                    className={cn(
                      'flex flex-col items-center justify-center gap-2 p-6 rounded-lg border-2 border-dashed cursor-pointer transition-colors',
                      gpx?.status === 'uploading'
                        ? 'border-[var(--color-lime)] bg-[color-mix(in_srgb,var(--color-lime)_5%,transparent)]'
                        : gpx?.status === 'error'
                          ? 'border-[var(--color-danger)] bg-[color-mix(in_srgb,var(--color-danger)_5%,transparent)]'
                          : 'border-[var(--color-line)] hover:border-[color-mix(in_srgb,var(--color-lime)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--color-lime)_3%,transparent)]'
                    )}
                  >
                    <input
                      type="file"
                      accept=".gpx"
                      className="sr-only"
                      ref={(el) => { fileRefs.current[race.id] = el }}
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) handleGpxUpload(race.id, file)
                      }}
                    />
                    {gpx?.status === 'uploading' ? (
                      <>
                        <LoaderIcon size={20} className="text-[var(--color-lime)] animate-spin" />
                        <span className="text-sm text-[var(--color-lime)]">Traitement en cours…</span>
                      </>
                    ) : gpx?.status === 'error' ? (
                      <>
                        <FileIcon size={20} className="text-[var(--color-danger)]" />
                        <span className="text-sm text-[var(--color-danger)]">{gpx.error}</span>
                        <span className="text-xs text-[var(--color-ink-4)]">Cliquer pour réessayer</span>
                      </>
                    ) : (
                      <>
                        <UploadIcon size={20} className="text-[var(--color-ink-4)]" />
                        <span className="text-sm text-[var(--color-ink-3)]">Glisser un fichier GPX</span>
                        <span className="text-xs text-[var(--color-ink-4)]">ou cliquer pour sélectionner</span>
                      </>
                    )}
                  </label>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Add race */}
      <Button
        variant="secondary"
        onClick={handleAddRace}
        disabled={adding}
        className="w-full gap-2"
      >
        {adding ? <LoaderIcon size={15} className="animate-spin" /> : <PlusIcon size={15} />}
        Ajouter une course
      </Button>

      {/* Resources */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg-1)] p-5">
        <h3 className="text-sm font-semibold text-[var(--color-ink)] mb-4">Ressources disponibles</h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-[var(--color-ink-3)] mb-2">Effectif disponible</label>
            <NumStep
              value={effectif}
              onChange={setEffectif}
              step={5}
              min={0}
              max={500}
              suffix="personnes"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--color-ink-3)] mb-2">Barrières disponibles</label>
            <NumStep
              value={barrieres}
              onChange={setBarrieres}
              step={1}
              min={0}
              max={200}
              suffix="barrières"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

interface NumStepProps {
  value: number
  onChange: (v: number) => void
  step: number
  min: number
  max: number
  suffix?: string
}

function NumStep({ value, onChange, step, min, max, suffix }: NumStepProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onChange(Math.max(min, value - step))}
        className="w-8 h-8 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-line)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors flex items-center justify-center text-base font-medium"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        onChange={(e) => {
          const v = parseInt(e.target.value)
          if (!isNaN(v)) onChange(Math.min(max, Math.max(min, v)))
        }}
        className="w-20 text-center bg-[var(--color-bg-2)] border border-[var(--color-line)] rounded-lg px-2 py-1.5 text-[var(--color-ink)] text-sm focus:outline-none focus:border-[var(--color-lime)] transition-colors"
      />
      <button
        onClick={() => onChange(Math.min(max, value + step))}
        className="w-8 h-8 rounded-lg bg-[var(--color-bg-2)] border border-[var(--color-line)] text-[var(--color-ink-2)] hover:text-[var(--color-ink)] transition-colors flex items-center justify-center text-base font-medium"
      >
        +
      </button>
      {suffix && <span className="text-xs text-[var(--color-ink-4)]">{suffix}</span>}
    </div>
  )
}
