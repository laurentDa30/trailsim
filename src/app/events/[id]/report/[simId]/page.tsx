import { notFound } from 'next/navigation'
import db from '@/lib/db'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'
import {
  clusterRiskZones,
  clusterCollisionWindows,
  computePerRaceStats,
  computeRecommendations,
  type RaceLite,
} from '@/lib/report-metrics'
import { OperationalMap, type OpMapRace, type OpMapZone } from './operational-map'
import { ReportToolbar } from './report-toolbar'

interface PageProps {
  params: Promise<{ id: string; simId: string }>
}

function fmtClock(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
}

/** Cap a polyline to ~maxPts points for a lightweight SVG, keeping ends. */
function downsample<T>(arr: T[], maxPts = 400): T[] {
  if (arr.length <= maxPts) return arr
  const step = Math.ceil(arr.length / maxPts)
  const out: T[] = []
  for (let i = 0; i < arr.length; i += step) out.push(arr[i])
  if (out[out.length - 1] !== arr[arr.length - 1]) out.push(arr[arr.length - 1])
  return out
}

export default async function ReportPage({ params }: PageProps) {
  const { id, simId } = await params

  const sim = await db.simulation.findUnique({
    where: { id: simId },
    include: { event: true, runnerProfiles: true },
  })

  if (!sim) notFound()

  const races = await db.race.findMany({
    where: { eventId: id },
    include: { segments: true },
  })

  let result: CompressedSimulationResult | null = null
  if (sim.resultSnapshot) {
    try {
      result = JSON.parse(sim.resultSnapshot) as CompressedSimulationResult
    } catch {
      result = null
    }
  }

  const parsedRaces = races.map((race) => {
    let gpxPoints: GPXPoint[] = []
    try {
      gpxPoints = JSON.parse(race.gpxPoints) as GPXPoint[]
    } catch {
      gpxPoints = []
    }
    return { ...race, gpxPoints }
  })

  const racesLite: RaceLite[] = parsedRaces.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    gpxPoints: r.gpxPoints,
  }))

  // ── Derived metrics ──
  const clustered = result ? clusterRiskZones(result.riskMap, racesLite) : []
  const perRace = result ? computePerRaceStats(result, racesLite, clustered) : []
  const recommendations = result ? computeRecommendations(result, racesLite, clustered, perRace) : []

  const bouchons = [...clustered].sort((a, b) => b.riskScore - a.riskScore)
  // Clustered: one row per real catch-up event, not one per 150 m bin.
  const collisionWindows = result ? clusterCollisionWindows(result.collisionWindows, racesLite) : []

  // Global headline figures
  const firstFinish = perRace
    .filter((s) => s.finishSec != null)
    .sort((a, b) => (a.finishSec! - b.finishSec!))[0]
  const dnfTotal = perRace.reduce((acc, s) => acc + s.dnf, 0)
  const maxAffluence = perRace.reduce((acc, s) => Math.max(acc, s.maxLocal), 0)

  // Speed range across profiles
  const speedLo = sim.runnerProfiles.length
    ? Math.min(...sim.runnerProfiles.map((p) => p.baseSpeedMin))
    : null
  const speedHi = sim.runnerProfiles.length
    ? Math.max(...sim.runnerProfiles.map((p) => p.baseSpeedMax))
    : null

  // Départs (faithful snapshot when available)
  let depSnap: { id: string; name: string; startTime: number; color?: string }[] = []
  try {
    if (sim.racesSnapshot) depSnap = JSON.parse(sim.racesSnapshot)
  } catch {
    depSnap = []
  }
  const departs =
    depSnap.length > 0
      ? depSnap
      : parsedRaces.map((r) => ({ id: r.id, name: r.name, startTime: r.startTime, color: r.color }))

  // ── Map data (plain shapes for the client SVG) ──
  const mapRaces: OpMapRace[] = parsedRaces.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    points: downsample(r.gpxPoints).map((p) => ({ lat: p.lat, lng: p.lng, dist: p.dist })),
    segments: r.segments.map((s) => ({
      type: s.type,
      label: s.label,
      lat: s.lat,
      lng: s.lng,
      dist: r.gpxPoints[s.indexStart]?.dist ?? 0,
    })),
  }))
  const mapZones: OpMapZone[] = clustered
    .map((z) => {
      const race = parsedRaces.find((r) => r.id === z.raceId)
      const pt = race?.gpxPoints[z.segmentIndex]
      if (!pt) return null
      return { raceId: z.raceId, lat: pt.lat, lng: pt.lng, dist: z.dist, kind: z.kind }
    })
    .filter((z): z is OpMapZone => z != null)

  return (
    <div
      style={{
        background: '#f3f4f6',
        minHeight: '100vh',
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: 'antialiased',
        color: '#111827',
      }}
    >
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .sheet { box-shadow: none !important; margin: 0 auto !important; }
          .page-break { page-break-before: always; }
          .avoid-break { break-inside: avoid; }
        }
        @page { margin: 14mm; }
      `}</style>

      <ReportToolbar eventId={id} simId={simId} terrainHref={`/events/${id}/terrain/${simId}`} />

      {/* A4 Report sheet */}
      <div
        className="sheet"
        style={{
          maxWidth: '794px',
          margin: '32px auto',
          background: '#ffffff',
          padding: '48px 52px',
          boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
          marginBottom: '32px',
        }}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '44px',
                height: '44px',
                background: '#7CB518',
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                <polyline
                  points="2,22 6,16 10,19 14,10 18,14 22,8 26,12"
                  stroke="white"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
              </svg>
            </div>
            <span style={{ fontSize: '24px', fontWeight: 400, color: '#111827', letterSpacing: '-0.5px' }}>
              Trail<strong>Sim</strong>
            </span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '1.5px',
                color: '#9ca3af',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}
            >
              RAPPORT DE SIMULATION
            </div>
            <div style={{ fontSize: '16px', fontWeight: 700, color: '#111827', marginBottom: '4px' }}>
              {sim.event.name}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {fmtDate(sim.event.date)}
              {sim.event.location ? ` · ${sim.event.location}` : ''}
            </div>
            <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: 2 }}>{sim.name}</div>
          </div>
        </div>

        <div style={{ height: '2.5px', background: '#7CB518', marginTop: '18px', marginBottom: '28px', borderRadius: '2px' }} />

        {!result && (
          <p style={{ color: '#9ca3af', fontSize: 13 }}>
            Aucun résultat enregistré pour cette simulation.
          </p>
        )}

        {/* ── RÉSUMÉ ── */}
        <SectionTitle>RÉSUMÉ</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '28px' }}>
          <StatCard value={String(sim.totalRunners)} label="Coureurs" />
          <StatCard value={String(races.length)} label="Courses" />
          <StatCard value={firstFinish?.finishSec != null ? fmtClock(firstFinish.finishSec) : '—'} label="1ère arrivée (T+)" sub={firstFinish?.name} />
          <StatCard value={`≈ ${dnfTotal}`} label="Abandons estimés" tone="warning" />
          <StatCard value={String(maxAffluence)} label="Affluence max /150 m" />
          <StatCard value={String(clustered.length)} label="Zones à risque" />
          <StatCard value={String(collisionWindows.length)} label="Croisements" />
          <StatCard value={speedLo != null ? `${speedLo}–${speedHi}` : '—'} label="Vitesses (km/h)" />
        </div>

        {/* ── SYNTHÈSE PAR COURSE ── */}
        <SectionTitle>SYNTHÈSE PAR COURSE</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Course', 'Départ', 'Coureurs', 'Durée vainqueur', 'Abandons', 'Affluence /150m', 'Zones'].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perRace.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ padding: '16px 10px', color: '#9ca3af', textAlign: 'center' }}>
                  Aucune donnée
                </td>
              </tr>
            ) : (
              perRace.map((s, i) => {
                const dep = departs.find((d) => d.id === s.id)
                return (
                  <tr key={s.id} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: '#374151' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                        {s.name}
                      </span>
                    </td>
                    <td style={tdMono}>{dep && dep.startTime ? `T+${dep.startTime}'` : 'T0'}</td>
                    <td style={tdMono}>{s.total}</td>
                    <td style={tdMono}>{s.firstDuration != null ? fmtClock(s.firstDuration) : '—'}</td>
                    <td style={{ ...tdMono, color: s.dnf > 0 ? '#D97706' : '#374151' }}>{s.dnf}</td>
                    <td style={tdMono}>{s.maxLocal}</td>
                    <td style={tdMono}>{s.zones}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* ── RECOMMANDATIONS ── */}
        <SectionTitle>RECOMMANDATIONS — FLUIDITÉ &amp; SÉCURITÉ</SectionTitle>
        <div style={{ marginBottom: '28px' }}>
          {recommendations.length === 0 ? (
            <p style={{ color: '#16A34A', fontSize: 13, fontWeight: 500 }}>
              Aucun point de vigilance majeur détecté : le parcours est fluide avec cette configuration.
            </p>
          ) : (
            recommendations.map((r, i) => (
              <div
                key={i}
                className="avoid-break"
                style={{
                  display: 'flex',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: '1px solid #f1f0ec',
                  borderLeft: `3px solid ${prioColor(r.priority)}`,
                  marginBottom: 8,
                  background: '#fdfdfc',
                }}
              >
                <div style={{ minWidth: 92 }}>
                  <PriorityBadge p={r.priority} />
                  <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {r.category}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 2 }}>{r.where}</div>
                  <div style={{ fontSize: 12, color: '#4b5563', lineHeight: 1.5 }}>{r.action}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* ── BOUCHONS & AFFLUENCE ── */}
        <div className="page-break" />
        <SectionTitle>BOUCHONS &amp; AFFLUENCE</SectionTitle>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '28px', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Course', 'Km', 'Type', 'Densité pic', 'Bloqué', 'Score'].map((h) => (
                <th key={h} style={thStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bouchons.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '16px 10px', color: '#9ca3af', textAlign: 'center' }}>
                  Aucune zone à risque détectée
                </td>
              </tr>
            ) : (
              bouchons.map((z, i) => {
                const race = parsedRaces.find((r) => r.id === z.raceId)
                const color = scoreColor(z.riskScore)
                return (
                  <tr key={i} style={{ borderBottom: '1px solid #f3f4f6', background: i % 2 ? '#fafafa' : '#fff' }}>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: race?.color ?? '#999', display: 'inline-block', flexShrink: 0 }} />
                        {race?.name ?? z.raceId}
                      </span>
                    </td>
                    <td style={tdMono}>{z.dist.toFixed(1)}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                          background: z.kind === 'bouchon' ? '#fee2e2' : '#fef3c7',
                          color: z.kind === 'bouchon' ? '#DC2626' : '#D97706',
                        }}
                      >
                        {z.kind === 'bouchon' ? 'Bouchon' : 'Affluence'}
                      </span>
                    </td>
                    <td style={tdMono}>{Math.round(z.peakDensity)} /150m</td>
                    <td style={tdMono}>{z.kind === 'bouchon' ? `${Math.round(z.jamProbability * 100)}%` : '—'}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 700, color }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
                        {Math.round(z.riskScore * 100)}
                      </span>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
        {bouchons.length > 0 && (
          <p style={{ fontSize: 11, color: '#9ca3af', marginTop: -16, marginBottom: 28, lineHeight: 1.5 }}>
            « Densité pic » = moyenne sur l&apos;ensemble des simulations (valeur statistique).
            L&apos;« affluence » de la synthèse par course est le pic instantané du scénario affiché —
            les deux unités /150 m ne sont donc pas directement comparables.
          </p>
        )}

        {/* ── CROISEMENTS INTER-COURSES ── */}
        <SectionTitle>CROISEMENTS INTER-COURSES</SectionTitle>
        <div style={{ marginBottom: '28px' }}>
          {collisionWindows.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>
              {races.length < 2
                ? 'Une seule course : pas de croisement inter-courses possible.'
                : 'Aucun croisement de pelotons détecté.'}
            </p>
          ) : (
            collisionWindows.map((cw, i) => {
              const cwRaces = cw.raceIds
                .map((rid) => parsedRaces.find((r) => r.id === rid))
                .filter(Boolean) as typeof parsedRaces
              const dist = cw.dist
              return (
                <div
                  key={i}
                  className="avoid-break"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '8px',
                    background: '#fefce8',
                    border: '1px solid #fde68a',
                    marginBottom: '8px',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flex: 1 }}>
                    {cwRaces.map((r) => (
                      <span
                        key={r.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          background: '#fff',
                          border: `1px solid ${r.color}`,
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#374151',
                        }}
                      >
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: r.color, display: 'inline-block' }} />
                        {r.name}
                      </span>
                    ))}
                  </div>
                  {dist != null && (
                    <span style={{ color: '#6b7280', fontSize: 12, fontFamily: "'JetBrains Mono', monospace", whiteSpace: 'nowrap' }}>
                      km {dist.toFixed(1)}
                    </span>
                  )}
                  <span style={{ color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {fmtClock(cw.tStart)} – {fmtClock(cw.tEnd)}
                  </span>
                  <span style={{ color: '#D97706', fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' }}>
                    jusqu&apos;à {Math.round(cw.peak)}
                  </span>
                </div>
              )
            })
          )}
          {collisionWindows.length > 0 && (
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 6, lineHeight: 1.5 }}>
              Plages <strong>probabilistes</strong> (sur l&apos;ensemble des simulations) : elles s&apos;ouvrent dès que la
              rencontre devient possible.
            </p>
          )}
        </div>

        {/* ── CARTE D'IMPLANTATION ── */}
        <div className="page-break" />
        <SectionTitle>CARTE D&apos;IMPLANTATION</SectionTitle>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 12, lineHeight: 1.5 }}>
          Tracés, ravitaillements, passages étroits, zones à risque et postes logistiques — le plan
          à déployer le jour J.
        </p>
        <div className="avoid-break">
          <OperationalMap simId={simId} races={mapRaces} zones={mapZones} height={460} showInventory />
        </div>

        {/* ── CONDITIONS & CONFIG ── */}
        <div className="page-break" />
        <SectionTitle>CONFIGURATION UTILISÉE</SectionTitle>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {departs.map((d) => (
            <span
              key={d.id}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 10px',
                borderRadius: 999,
                border: '1px solid #e5e7eb',
                fontSize: 12,
                color: '#374151',
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: d.color ?? '#999', display: 'inline-block' }} />
              {d.name}
              <span style={{ color: '#9ca3af' }}>· {d.startTime ? `T+${d.startTime} min` : 'T0'}</span>
            </span>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <CondCard label="Température" value={`${sim.temperature}°C`} />
          <CondCard label="Vent" value={`${sim.wind} km/h`} />
          <CondCard label="Pluie" value={sim.rain ? `Oui · ${sim.rainIntensity} mm/h` : 'Non'} />
          <CondCard label="Brouillard" value={sim.fog ? 'Oui' : 'Non'} />
          <CondCard label="Simulations (runs)" value={String(sim.nRuns)} />
          <CondCard label="Seuil bouchon" value={`${sim.jamThreshold} crs`} />
          <CondCard label="Seuil affluence" value={`${sim.affluenceThreshold} /150m`} />
          <CondCard label="Vitesses" value={speedLo != null ? `${speedLo}–${speedHi} km/h` : '—'} />
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            borderTop: '1px solid #e5e7eb',
            paddingTop: '16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: '#9ca3af',
          }}
        >
          <span>{fmtDate(sim.event.date)} · {sim.event.name}</span>
          <span>Généré par TrailSim · trailsim.fr</span>
        </div>
      </div>
    </div>
  )
}

/* ── Styles ── */
const thStyle: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 10px',
  fontWeight: 600,
  color: '#6b7280',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.6px',
}
const tdMono: React.CSSProperties = {
  padding: '8px 10px',
  color: '#374151',
  fontFamily: "'JetBrains Mono', 'Fira Mono', monospace",
}

function prioColor(p: 'haute' | 'moyenne' | 'faible'): string {
  return p === 'haute' ? '#DC2626' : p === 'moyenne' ? '#D97706' : '#6b7280'
}

function scoreColor(score: number): string {
  if (score >= 0.8) return '#DC2626'
  if (score >= 0.5) return '#D97706'
  return '#16A34A'
}

/* ── Sub-components ── */

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '1.5px',
        color: '#7CB518',
        textTransform: 'uppercase',
        marginBottom: '12px',
        paddingBottom: '6px',
        borderBottom: '1px solid #f3f4f6',
      }}
    >
      {children}
    </div>
  )
}

function StatCard({ value, label, sub, tone }: { value: string; label: string; sub?: string; tone?: 'warning' }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '14px 12px', textAlign: 'center' }}>
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace",
          fontSize: '22px',
          fontWeight: 700,
          color: tone === 'warning' ? '#D97706' : '#111827',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function CondCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  )
}

function PriorityBadge({ p }: { p: 'haute' | 'moyenne' | 'faible' }) {
  const c = prioColor(p)
  return (
    <span
      style={{
        display: 'inline-block',
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        padding: '2px 8px',
        borderRadius: 999,
        color: c,
        background: `${c}1a`,
      }}
    >
      {p}
    </span>
  )
}
