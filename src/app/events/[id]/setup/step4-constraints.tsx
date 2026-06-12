'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { AlertTriangleIcon, Trash2Icon, MapPinIcon } from 'lucide-react'
import type { GPXPoint } from '@/engine/types'
import { CONSTRAINT_PRESETS, RAVITO_PRESET, presetOf } from './constraint-presets'
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
  segments?: { id: string; type: string; lat: number; lng: number; indexStart: number; lengthM: number; ravitoSec?: number | null }[]
}

interface Step4ConstraintsProps {
  eventId: string
  races: RaceLike[]
  jamThreshold: number
  onJamThresholdChange: (v: number) => void
  affluenceThreshold: number
  onAffluenceThresholdChange: (v: number) => void
  nRuns: number
  onNRunsChange: (v: number) => void
  logistics: PlacedLogi[]
  onLogisticsChange: (l: PlacedLogi[]) => void
  resources: { effectif: number; barrieres: number }
}

const PERSONNEL_TYPES = ['signaleur', 'benevole', 'medical', 'chrono']
const RUN_OPTIONS = [50, 100, 200, 300]
const ZONE_LENGTHS = [50, 100, 200, 400, 800]

export function Step4Constraints({
  eventId,
  races,
  jamThreshold,
  onJamThresholdChange,
  affluenceThreshold,
  onAffluenceThresholdChange,
  nRuns,
  onNRunsChange,
  logistics,
  onLogisticsChange,
  resources,
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
      (r.segments ?? []).map((s) => ({
        id: s.id,
        raceId: r.id,
        lat: s.lat,
        lng: s.lng,
        type: s.type,
        indexStart: s.indexStart,
        lengthM: s.lengthM,
        ravitoSec: s.ravitoSec ?? null,
      }))
    )
  )
  const [placingPreset, setPlacingPreset] = useState<string | null>(null)
  const [placingLogiType, setPlacingLogiType] = useState<string | null>(null)
  const [zoneLength, setZoneLength] = useState(200)
  // Which traces are shown — a click places on every visible course passing the
  // spot, so hiding traces is how you target a single course on a shared section.
  const [visibleRaces, setVisibleRaces] = useState<Set<string>>(
    () => new Set(parsedRaces.map((r) => r.id))
  )

  function toggleRaceVisible(id: string) {
    setVisibleRaces((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

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
          lengthM: zoneLength,
        }),
      })
      if (res.ok) {
        const seg = (await res.json()) as { id: string }
        setConstraints((prev) => [
          ...prev,
          { id: seg.id, raceId, lat, lng, type: preset.type, indexStart, lengthM: zoneLength },
        ])
      }
    } catch {
      /* ignore transient errors */
    }
  }

  async function handleSetRavitoSec(id: string, sec: number | null) {
    const c = constraints.find((x) => x.id === id)
    if (!c || (c.ravitoSec ?? null) === sec) return
    setConstraints((prev) => prev.map((x) => (x.id === id ? { ...x, ravitoSec: sec } : x)))
    try {
      await fetch(`/api/events/${eventId}/races/${c.raceId}/segments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ravitoSec: sec }),
      })
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
  const placedCount = constraints.length + logistics.length

  async function resetAll() {
    if (placedCount === 0) return
    if (!confirm('Supprimer tous les points sensibles, ravitos et la logistique placés ?')) return
    const toDelete = [...constraints]
    setConstraints([])
    onLogisticsChange([])
    setPlacingPreset(null)
    setPlacingLogiType(null)
    await Promise.all(
      toDelete.map((c) =>
        fetch(`/api/events/${eventId}/races/${c.raceId}/segments/${c.id}`, { method: 'DELETE' }).catch(() => {})
      )
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
            Points sensibles & logistique
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--color-ink-3)' }}>
            Marquez les portions étroites/techniques où l&apos;on ne peut pas doubler (les bouchons s&apos;y
            forment) et positionnez votre logistique terrain. Choisissez un type puis cliquez sur la carte.
            Un clic marque la portion sur <b>toutes les courses visibles</b> qui passent à cet endroit —
            masquez une trace ci-dessous pour ne viser qu&apos;une course.
          </p>
        </div>
        <button
          type="button"
          onClick={resetAll}
          disabled={placedCount === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0 transition-colors disabled:opacity-40"
          style={{
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-line)',
            color: 'var(--color-danger)',
          }}
          title="Effacer tout ce qui est placé"
        >
          <Trash2Icon size={13} />
          Tout réinitialiser{placedCount > 0 ? ` (${placedCount})` : ''}
        </button>
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
        {/* Zone length */}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
            Longueur de la zone
          </span>
          <div className="flex items-center gap-1">
            {ZONE_LENGTHS.map((m) => {
              const active = zoneLength === m
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => setZoneLength(m)}
                  className="px-2 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors"
                  style={{
                    background: active ? 'var(--color-lime)' : 'var(--color-bg-2)',
                    color: active ? '#ffffff' : 'var(--color-ink-3)',
                    border: '1px solid',
                    borderColor: active ? 'var(--color-lime)' : 'var(--color-line)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {m < 1000 ? `${m}m` : `${m / 1000}km`}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Ravito buttons — snap to trace */}
      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
          Ravitaillements (sur le tracé)
        </span>
        <div className="flex flex-wrap gap-2 mt-2">
          {(() => {
            const active = placingPreset === RAVITO_PRESET.type
            const count = constraints.filter((c) => c.type === RAVITO_PRESET.type).length
            return (
              <button
                type="button"
                onClick={() => {
                  setPlacingLogiType(null)
                  setPlacingPreset((cur) => (cur === RAVITO_PRESET.type ? null : RAVITO_PRESET.type))
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors"
                style={{
                  background: active ? 'var(--color-bg-2)' : 'var(--color-bg-1)',
                  border: '1px solid',
                  borderColor: active ? RAVITO_PRESET.color : 'var(--color-line)',
                }}
              >
                <span
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 text-[11px] font-bold text-white"
                  style={{ background: RAVITO_PRESET.color }}
                >
                  {RAVITO_PRESET.letter}
                </span>
                <span className="flex flex-col">
                  <span className="text-sm" style={{ color: 'var(--color-ink)' }}>
                    {RAVITO_PRESET.label}
                    {count > 0 && (
                      <span className="ml-1.5 text-[11px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
                        ×{count}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
                    {RAVITO_PRESET.description}
                  </span>
                </span>
              </button>
            )
          })()}
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

        {/* Effectifs déployés */}
        {(() => {
          const personnel = logistics.filter((l) => PERSONNEL_TYPES.includes(l.type)).length
          const barrages = logistics.filter((l) => l.type === 'barrage').length
          const bar = (used: number, total: number) => {
            const over = used > total
            const pct = total > 0 ? Math.min(100, (used / total) * 100) : 0
            const color = over ? 'var(--color-danger)' : 'var(--color-safe)'
            return { over, pct, color }
          }
          const p = bar(personnel, resources.effectif)
          const b = bar(barrages, resources.barrieres)
          return (
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: 'Personnel déployé', used: personnel, total: resources.effectif, m: p },
                { label: 'Barrages posés', used: barrages, total: resources.barrieres, m: b },
              ].map((row) => (
                <div key={row.label} className="flex flex-col gap-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span style={{ color: 'var(--color-ink-3)' }}>{row.label}</span>
                    <span className="font-mono tabular-nums" style={{ color: row.m.color }}>
                      {row.used} / {row.total}
                      {row.m.over && ' ⚠'}
                    </span>
                  </div>
                  <div
                    className="h-1.5 rounded-full overflow-hidden"
                    style={{ background: 'var(--color-bg-2)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${row.m.pct}%`, background: row.m.color }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )
        })()}
      </div>

      {/* Trace show/hide — only useful with several courses */}
      {parsedRaces.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
            Tracés
          </span>
          {parsedRaces.map((r) => {
            const on = visibleRaces.has(r.id)
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleRaceVisible(r.id)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs transition-colors"
                style={{
                  background: 'var(--color-bg-1)',
                  border: '1px solid',
                  borderColor: on ? r.color : 'var(--color-line)',
                  opacity: on ? 1 : 0.45,
                }}
                title={on ? 'Masquer ce tracé' : 'Afficher ce tracé'}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color }} />
                <span style={{ color: 'var(--color-ink-2)' }}>{r.name}</span>
              </button>
            )
          })}
        </div>
      )}

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
            onSetRavitoSec={handleSetRavitoSec}
            visibleRaces={visibleRaces}
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
              Cliquez sur le tracé : <b>{presetOf(placingPreset).label}</b>
              <span style={{ color: 'var(--color-ink-4)' }}> · toutes les courses visibles qui passent là</span>
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

      {/* Affluence threshold */}
      <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Seuil d&apos;affluence
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-3)' }}>
              Coureurs concentrés sur ~150 m pour signaler une zone d&apos;affluence (même sans
              blocage).
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onAffluenceThresholdChange(Math.max(5, affluenceThreshold - 5))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
            >
              −
            </button>
            <span className="w-12 text-center font-mono text-lg font-bold tabular-nums" style={{ color: 'var(--color-warning)' }}>
              {affluenceThreshold}
            </span>
            <button
              type="button"
              onClick={() => onAffluenceThresholdChange(Math.min(200, affluenceThreshold + 5))}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
              style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Number of Monte-Carlo runs (precision vs speed) */}
      <div className="rounded-xl p-4" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Nombre de simulations (runs)
            </h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-ink-3)' }}>
              Plus de runs = résultats plus stables (convergence ↑) mais calcul plus long.
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {RUN_OPTIONS.map((n) => {
              const active = nRuns === n
              return (
                <button
                  key={n}
                  type="button"
                  onClick={() => onNRunsChange(n)}
                  className="px-2.5 py-1.5 rounded-lg text-sm font-mono tabular-nums transition-colors"
                  style={{
                    background: active ? 'var(--color-lime)' : 'var(--color-bg-2)',
                    color: active ? '#ffffff' : 'var(--color-ink-3)',
                    border: '1px solid',
                    borderColor: active ? 'var(--color-lime)' : 'var(--color-line)',
                    fontWeight: active ? 700 : 400,
                  }}
                >
                  {n}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
