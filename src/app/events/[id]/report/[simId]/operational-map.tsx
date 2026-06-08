'use client'

import { useMemo, useState } from 'react'
import { LOGI_TYPES, logiStorageKey, logiTypeOf, type PlacedLogi } from '@/lib/logistics'

// ── Plain data shapes passed from the server (no Prisma / engine types) ──
export interface OpMapPoint {
  lat: number
  lng: number
  dist: number // km from start
}
export interface OpMapSegment {
  type: string // 'RAVITO' | 'SINGLE' | 'NARROW' | 'TECHNIQUE' | …
  label?: string | null
  lat: number
  lng: number
  dist: number
}
export interface OpMapRace {
  id: string
  name: string
  color: string
  points: OpMapPoint[]
  segments: OpMapSegment[]
}
export interface OpMapZone {
  raceId: string
  lat: number
  lng: number
  dist: number
  kind: 'bouchon' | 'affluence'
}

interface Props {
  simId: string
  races: OpMapRace[]
  zones: OpMapZone[]
  /** Drawing height in px. Width follows the A4-landscape ratio. */
  height?: number
  /** Show the placed-logistics inventory table under the map. */
  showInventory?: boolean
}

const VB_W = 1000
const VB_H = 680
const PAD = 28

interface Projected {
  project: (lat: number, lng: number) => { x: number; y: number }
  ok: boolean
}

/** Equirectangular projection fitted (letter-boxed) into the viewBox. */
function buildProjection(races: OpMapRace[], zones: OpMapZone[], logistics: PlacedLogi[]): Projected {
  const lats: number[] = []
  const lngs: number[] = []
  for (const r of races) {
    for (const p of r.points) {
      lats.push(p.lat)
      lngs.push(p.lng)
    }
    for (const s of r.segments) {
      lats.push(s.lat)
      lngs.push(s.lng)
    }
  }
  for (const z of zones) {
    lats.push(z.lat)
    lngs.push(z.lng)
  }
  for (const l of logistics) {
    lats.push(l.lat)
    lngs.push(l.lng)
  }
  const valid = lats.filter((v) => Number.isFinite(v) && v !== 0)
  if (valid.length < 2) return { project: () => ({ x: VB_W / 2, y: VB_H / 2 }), ok: false }

  const latMin = Math.min(...lats)
  const latMax = Math.max(...lats)
  const lngMin = Math.min(...lngs)
  const lngMax = Math.max(...lngs)
  const latMid = (latMin + latMax) / 2
  const kx = Math.cos((latMid * Math.PI) / 180) || 1

  // Data extent in projected units
  const dx = Math.max(1e-9, (lngMax - lngMin) * kx)
  const dy = Math.max(1e-9, latMax - latMin)
  const innerW = VB_W - PAD * 2
  const innerH = VB_H - PAD * 2
  const scale = Math.min(innerW / dx, innerH / dy)
  // Centre the (letter-boxed) drawing
  const offX = PAD + (innerW - dx * scale) / 2
  const offY = PAD + (innerH - dy * scale) / 2

  return {
    ok: true,
    project: (lat: number, lng: number) => ({
      x: offX + (lng - lngMin) * kx * scale,
      // invert Y: north is up
      y: offY + (latMax - lat) * scale,
    }),
  }
}

function nearest(races: OpMapRace[], lat: number, lng: number): { race: OpMapRace; dist: number } | null {
  let best: { race: OpMapRace; dist: number } | null = null
  let bestD = Infinity
  for (const r of races) {
    for (const p of r.points) {
      const dLat = p.lat - lat
      const dLng = p.lng - lng
      const d = dLat * dLat + dLng * dLng
      if (d < bestD) {
        bestD = d
        best = { race: r, dist: p.dist }
      }
    }
  }
  return best
}

export function OperationalMap({ simId, races, zones, height = 460, showInventory = true }: Props) {
  // Placed logistics live in the browser (localStorage), seeded at config time.
  const [logistics] = useState<PlacedLogi[]>(() => {
    if (typeof window === 'undefined') return []
    try {
      const raw = localStorage.getItem(logiStorageKey(simId))
      if (raw) return JSON.parse(raw) as PlacedLogi[]
    } catch {
      /* ignore */
    }
    return []
  })

  const proj = useMemo(() => buildProjection(races, zones, logistics), [races, zones, logistics])

  const width = Math.round(height * (VB_W / VB_H))

  // Per-type counts for the inventory
  const logiByType = useMemo(() => {
    const m = new Map<string, number>()
    for (const l of logistics) m.set(l.type, (m.get(l.type) ?? 0) + 1)
    return m
  }, [logistics])

  const ravitoCount = useMemo(
    () => races.reduce((acc, r) => acc + r.segments.filter((s) => s.type === 'RAVITO').length, 0),
    [races]
  )

  return (
    <div>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#fcfcfb',
        }}
      >
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          width="100%"
          height={height}
          style={{ display: 'block', maxWidth: width, margin: '0 auto' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* subtle grid */}
          <defs>
            <pattern id="opgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M40 0H0V40" fill="none" stroke="#eef0ee" strokeWidth="1" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={VB_W} height={VB_H} fill="url(#opgrid)" />

          {!proj.ok && (
            <text x={VB_W / 2} y={VB_H / 2} textAnchor="middle" fill="#9ca3af" fontSize="16">
              Tracés indisponibles
            </text>
          )}

          {/* Traces */}
          {proj.ok &&
            races.map((r) => {
              if (r.points.length < 2) return null
              const d = r.points
                .map((p, i) => {
                  const { x, y } = proj.project(p.lat, p.lng)
                  return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
                })
                .join(' ')
              const start = proj.project(r.points[0].lat, r.points[0].lng)
              const end = proj.project(
                r.points[r.points.length - 1].lat,
                r.points[r.points.length - 1].lng
              )
              return (
                <g key={r.id}>
                  <path d={d} fill="none" stroke={r.color} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" opacity="0.92" />
                  {/* Start */}
                  <circle cx={start.x} cy={start.y} r="6" fill="#16A34A" stroke="#fff" strokeWidth="2" />
                  {/* Finish */}
                  <rect x={end.x - 5} y={end.y - 5} width="10" height="10" fill="#111827" stroke="#fff" strokeWidth="2" />
                </g>
              )
            })}

          {/* Constraints & ravitos (from DB segments) */}
          {proj.ok &&
            races.flatMap((r) =>
              r.segments.map((s, i) => {
                const { x, y } = proj.project(s.lat, s.lng)
                if (s.type === 'RAVITO') {
                  return (
                    <g key={`${r.id}-rav-${i}`}>
                      <rect x={x - 7} y={y - 7} width="14" height="14" rx="3" fill="#22D3EE" stroke="#fff" strokeWidth="2" />
                      <text x={x} y={y + 3.5} textAnchor="middle" fontSize="9" fontWeight="700" fill="#0e3a44">R</text>
                    </g>
                  )
                }
                // narrow / technical constraint
                return (
                  <g key={`${r.id}-c-${i}`}>
                    <path
                      d={`M${x},${y - 8} L${x + 7},${y + 6} L${x - 7},${y + 6} Z`}
                      fill="#D97706"
                      stroke="#fff"
                      strokeWidth="1.5"
                    />
                  </g>
                )
              })
            )}

          {/* Risk zones (bouchons / affluence) */}
          {proj.ok &&
            zones.map((z, i) => {
              const { x, y } = proj.project(z.lat, z.lng)
              const color = z.kind === 'bouchon' ? '#DC2626' : '#D97706'
              return (
                <g key={`z-${i}`}>
                  <circle cx={x} cy={y} r="9" fill="none" stroke={color} strokeWidth="2.5" opacity="0.9" />
                  <circle cx={x} cy={y} r="3" fill={color} />
                </g>
              )
            })}

          {/* Placed logistics */}
          {proj.ok &&
            logistics.map((l) => {
              const { x, y } = proj.project(l.lat, l.lng)
              const meta = logiTypeOf(l.type)
              return (
                <g key={l.id}>
                  <circle cx={x} cy={y} r="9" fill={meta.color} stroke="#fff" strokeWidth="2" />
                  <text x={x} y={y + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#fff">
                    {meta.letter}
                  </text>
                </g>
              )
            })}
        </svg>

        {/* Legend */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px 18px',
            padding: '10px 14px',
            borderTop: '1px solid #eef0ee',
            fontSize: 11,
            color: '#4b5563',
            background: '#fff',
          }}
        >
          <LegendDot color="#16A34A" round label="Départ" />
          <LegendDot color="#111827" label="Arrivée" />
          <LegendDot color="#22D3EE" label="Ravitaillement" letter="R" />
          <LegendTri color="#D97706" label="Passage étroit / technique" />
          <LegendRing color="#DC2626" label="Bouchon" />
          <LegendRing color="#D97706" label="Affluence" />
          {LOGI_TYPES.map((t) => (
            <LegendDot key={t.type} color={t.color} label={t.label} letter={t.letter} round />
          ))}
        </div>
      </div>

      {showInventory && (
        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 8 }}>
            <strong style={{ color: '#374151' }}>
              {logistics.length} poste{logistics.length > 1 ? 's' : ''}
            </strong>{' '}
            logistique{logistics.length > 1 ? 's' : ''} placé{logistics.length > 1 ? 's' : ''}
            {ravitoCount > 0 && (
              <>
                {' · '}
                <strong style={{ color: '#374151' }}>{ravitoCount}</strong> ravitaillement
                {ravitoCount > 1 ? 's' : ''}
              </>
            )}
          </div>

          {/* Counts per type */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {LOGI_TYPES.filter((t) => (logiByType.get(t.type) ?? 0) > 0).map((t) => (
              <span
                key={t.type}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  border: `1px solid ${t.color}`,
                  background: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#374151',
                }}
              >
                <span
                  style={{
                    width: 14,
                    height: 14,
                    borderRadius: '50%',
                    background: t.color,
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {t.letter}
                </span>
                {t.label} · {logiByType.get(t.type)}
              </span>
            ))}
            {logistics.length === 0 && (
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                Aucun poste placé pour cette simulation (placez-les depuis la vue Résultats).
              </span>
            )}
          </div>

          {/* Detail list */}
          {logistics.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
                  {['Poste', 'Course la plus proche', 'Km', 'Coordonnées'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '6px 10px',
                        fontWeight: 600,
                        color: '#6b7280',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.6px',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {logistics.map((l, i) => {
                  const meta = logiTypeOf(l.type)
                  const near = nearest(races, l.lat, l.lng)
                  return (
                    <tr key={l.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#374151' }}>
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: '50%',
                              background: meta.color,
                              color: '#fff',
                              fontSize: 9,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {meta.letter}
                          </span>
                          {meta.label}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px', color: '#374151' }}>
                        {near ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: near.race.color, display: 'inline-block' }} />
                            {near.race.name}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#374151', fontFamily: "'JetBrains Mono', monospace" }}>
                        {near ? near.dist.toFixed(1) : '—'}
                      </td>
                      <td style={{ padding: '7px 10px', color: '#9ca3af', fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
                        {l.lat.toFixed(5)}, {l.lng.toFixed(5)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function LegendDot({ color, label, letter, round }: { color: string; label: string; letter?: string; round?: boolean }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        style={{
          width: 14,
          height: 14,
          borderRadius: round ? '50%' : 2,
          background: color,
          color: '#fff',
          fontSize: 9,
          fontWeight: 700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {letter ?? ''}
      </span>
      {label}
    </span>
  )
}

function LegendTri({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <path d="M7 1 L13 12 L1 12 Z" fill={color} />
      </svg>
      {label}
    </span>
  )
}

function LegendRing({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <svg width="14" height="14" viewBox="0 0 14 14">
        <circle cx="7" cy="7" r="5.5" fill="none" stroke={color} strokeWidth="2" />
        <circle cx="7" cy="7" r="1.8" fill={color} />
      </svg>
      {label}
    </span>
  )
}
