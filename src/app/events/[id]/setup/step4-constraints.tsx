'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangleIcon, Trash2Icon, MapPinIcon } from 'lucide-react'
import type { GPXPoint } from '@/engine/types'
import { CONSTRAINT_PRESETS, presetOf } from './constraint-presets'
import type { ConstraintMarker } from './constraint-map'
import { LOGI_TYPES, logiTypeOf, type PlacedLogi } from '@/lib/logistics'

const ConstraintMap = dynamic(() => import('./constraint-map'), {
  ssr: false,
  loading: () => <div className="w-full h-full" style={{ background: 'var(--color-bg)' }} />,
})

interface RaceLike {
  id: string
  name: string
  color: string
  gpxPoints: string
  segments: { id: string; type: string; lat: number; lng: number; indexStart: number }[]
}

interface Step4ConstraintsProps {
  eventId: string
  races: RaceLike[]
  jamThreshold: number
  onJamThresholdChange: (v: number) => void
  logistics: PlacedLogi[]
  onLogisticsChange: (l: PlacedLogi[]) => void
}

export function Step4Constraints({
  eventId,
  races,
  jamThreshold,
  onJamThresholdChange,
  logistics,
  onLogisticsChange,
}: Step4ConstraintsProps) {
  // Parse GPX once for the map
  const parsedRaces = useMemo(
    () =>
      races.map((r) => {
        let gpxPoints: GPXPoint[] = []
        try {
          gpxPoints = JSON.parse(r.gpxPoints) as GPXPoint[]
        } catch {
          gpxPoints = []
        }
        return { id: r.id, name: r.name, color: r.color, gpxPoints }
      }),
    [races]
  )

  const [constraints, setConstraints] = useState<ConstraintMarker[]>(() =>
    races.flatMap((r) =>
      r.segments.map((s) => ({ id: s.id, raceId: r.id, lat: s.lat, lng: s.lng, type: s.type }))
    )
  )
  const [placingPreset, setPlacingPreset] = useState<string | null>(null)
  const [placingLogiType, setPlacingLogiType] = useState<string | null>(null)

  function newId() {
    return typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `logi-${Date.now()}-${Math.random().toString(36).slice(2)}`
  }

  function handlePlaceLogi(type: string, lat: number, lng: number) {
    onLogisticsChange([...logistics, { id: newId(), type, lat, lng }])
  }

  function handleRemoveLogi(id: string) {
    onLogisticsChange(logistics.filter((l) => l.id !== id))
  }

  async function handlePlace(raceId: string, indexStart: number, lat: number, lng: number) {
    if (!placingPreset) return
    const preset = presetOf(placingPreset)
    try {
      const res = await fetch(`/api/events/${eventId}/races/${raceId}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: preset.type,
          indexStart,
          lat,
          lng,
          width: preset.widthRatio,
          techLevel: preset.techLevel,
        }),
      })
      if (res.ok) {
        const seg = (await res.json()) as { id: string }
        setConstraints((prev) => [...prev, { id: seg.id, raceId, lat, lng, type: preset.type }])
      }
    } catch {
      /* ignore transient errors */
    }
  }

  async function handleRemove(id: string) {
    const c = constraints.find((x) => x.id === id)
    if (!c) return
    setConstraints((prev) => prev.filter((x) => x.id !== id))
    try {
      await fetch(`/api/events/${eventId}/races/${c.raceId}/segments/${id}`, { method: 'DELETE' })
    } catch {
      /* ignore */
    }
  }

  const hasTracks = parsedRaces.some((r) => r.gpxPoints.length > 1)

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
          Points sensibles & logistique
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-3)' }}>
          Marquez les portions étroites/techniques où l&apos;on ne peut pas doubler (les bouchons s&apos;y
          forment) et positionnez votre logistique terrain. Choisissez un type puis cliquez sur la carte.
        </p>
      </div>

      {/* Preset buttons — portions sensibles (snap to trace) */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
          Portions sensibles (sur le tracé)
        </span>
        <div className="flex flex-wrap gap-2 mt-2">
          {CONSTRAINT_PRESETS.map((p) => {
            const active = placingPreset === p.type
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => {
                  setPlacingLogiType(null)
                  setPlacingPreset((cur) => (cur === p.type ? null : p.type))
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  background: active ? 'var(--color-bg-2)' : 'var(--color-bg-1)',
                  border: '1px solid',
                  borderColor: active ? p.color : 'var(--color-line)',
                }}
              >
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                  style={{ background: p.color }}
                >
                  {p.letter}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                    {p.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
                    {p.description}
                  </span>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Logistics buttons — free placement */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
          Logistique terrain (placement libre)
        </span>
        <div className="flex flex-wrap gap-2 mt-2">
          {LOGI_TYPES.map((t) => {
            const active = placingLogiType === t.type
            const count = logistics.filter((l) => l.type === t.type).length
            return (
              <button
                key={t.type}
                type="button"
                onClick={() => {
                  setPlacingPreset(null)
                  setPlacingLogiType((cur) => (cur === t.type ? null : t.type))
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
                style={{
                  background: active ? 'var(--color-bg-2)' : 'var(--color-bg-1)',
                  border: '1px solid',
                  borderColor: active ? t.color : 'var(--color-line)',
                }}
              >
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                  style={{ background: t.color }}
                >
                  {t.letter}
                </span>
                <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                  {t.label}
                </span>
                {count > 0 && (
                  <span className="text-[11px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                    ×{count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Map */}
      <div
        className="relative rounded-xl overflow-hidden"
        style={{ height: 380, border: '1px solid var(--color-line)' }}
      >
        {hasTracks ? (
          <ConstraintMap
            races={parsedRaces}
            constraints={constraints}
            placingPreset={placingPreset}
            onPlace={handlePlace}
            onRemove={handleRemove}
            logistics={logistics}
            placingLogiType={placingLogiType}
            onPlaceLogi={handlePlaceLogi}
            onRemoveLogi={handleRemoveLogi}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center text-sm"
            style={{ color: 'var(--color-ink-4)' }}
          >
            Importez un GPX (étape 1) pour afficher les tracés.
          </div>
        )}

        {placingPreset && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg"
            style={{ background: 'var(--color-bg-1)', border: `1px solid ${presetOf(placingPreset).color}` }}
          >
            <AlertTriangleIcon size={14} style={{ color: presetOf(placingPreset).color }} />
            <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
              Cliquez sur le tracé pour placer : <b>{presetOf(placingPreset).label}</b>
            </span>
          </div>
        )}

        {placingLogiType && (
          <div
            className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-2 px-3 py-2 rounded-lg shadow-lg"
            style={{ background: 'var(--color-bg-1)', border: `1px solid ${logiTypeOf(placingLogiType).color}` }}
          >
            <MapPinIcon size={14} style={{ color: logiTypeOf(placingLogiType).color }} />
            <span className="text-xs" style={{ color: 'var(--color-ink)' }}>
              Cliquez n&apos;importe où pour placer : <b>{logiTypeOf(placingLogiType).label}</b>
            </span>
          </div>
        )}
      </div>

      {/* Placed list */}
      {constraints.length > 0 && (
        <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-ink)' }}>
            Portions marquées ({constraints.length})
          </h3>
          <div className="flex flex-col gap-1.5">
            {constraints.map((c) => {
              const preset = presetOf(c.type)
              const race = parsedRaces.find((r) => r.id === c.raceId)
              return (
                <div key={c.id} className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded flex items-center justify-center shrink-0 text-[9px] font-bold text-white"
                    style={{ background: preset.color }}
                  >
                    {preset.letter}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--color-ink-2)' }}>
                    {preset.label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
                    {race?.name}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemove(c.id)}
                    className="ml-auto hover:text-[var(--color-danger)] transition-colors"
                    style={{ color: 'var(--color-ink-4)' }}
                  >
                    <Trash2Icon size={13} />
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Jam threshold */}
      <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Début de bouchon
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-3)' }}>
              Nombre de coureurs ralentis simultanément pour qu&apos;une portion compte comme un
              bouchon.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onJamThresholdChange(Math.max(2, jamThreshold - 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
            >
              −
            </button>
            <span className="w-12 text-center font-mono text-lg font-bold tabular-nums" style={{ color: 'var(--color-lime)' }}>
              {jamThreshold}
            </span>
            <button
              type="button"
              onClick={() => onJamThresholdChange(Math.min(100, jamThreshold + 1))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
