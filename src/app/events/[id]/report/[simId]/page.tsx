import { notFound } from 'next/navigation'
import db from '@/lib/db'
import type { CompressedSimulationResult, GPXPoint } from '@/engine/types'

interface PageProps {
  params: Promise<{ id: string; simId: string }>
}

function fmtTime(s: number) {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h${String(m).padStart(2, '0')}`
}

function fmtDate(d: Date | null | undefined): string {
  if (!d) return '—'
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(d))
}

function scoreColor(score: number): string {
  if (score >= 80) return '#DC2626'
  if (score >= 60) return '#D97706'
  return '#16A34A'
}

export default async function ReportPage({ params }: PageProps) {
  const { id, simId } = await params

  const sim = await db.simulation.findUnique({
    where: { id: simId },
    include: { event: true, runnerProfiles: true },
  })

  if (!sim) notFound()

  const races = await db.race.findMany({ where: { eventId: id } })

  let result: CompressedSimulationResult | null = null
  if (sim.resultSnapshot) {
    try {
      result = JSON.parse(sim.resultSnapshot) as CompressedSimulationResult
    } catch {
      result = null
    }
  }

  // Parse gpxPoints for all races
  const parsedRaces = races.map((race) => {
    let gpxPoints: GPXPoint[] = []
    try {
      gpxPoints = JSON.parse(race.gpxPoints) as GPXPoint[]
    } catch {
      gpxPoints = []
    }
    return { ...race, gpxPoints }
  })

  // Risk zones sorted by score (top 10)
  const riskZones = result
    ? [...result.riskMap].sort((a, b) => b.riskScore - a.riskScore).slice(0, 10)
    : []

  // Stats
  const totalRunners = sim.totalRunners
  const totalCourses = races.length
  const riskZoneCount = riskZones.length
  const avgAbandon =
    sim.runnerProfiles.length > 0
      ? (
          sim.runnerProfiles.reduce((acc, p) => acc + p.abandonRate * p.percentage, 0) /
          sim.runnerProfiles.reduce((acc, p) => acc + p.percentage, 0)
        ).toFixed(1)
      : '—'

  const printStyles = `
    @media print {
      body { background: white; }
      .no-print { display: none !important; }
      .page-break { page-break-before: always; }
    }
  `

  return (
    <div
      style={{
        background: '#f3f4f6',
        minHeight: '100vh',
        fontFamily:
          "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        WebkitFontSmoothing: 'antialiased',
      }}
    >
      <style>{printStyles}</style>

      {/* No-print controls bar */}
      <div
        className="no-print"
        style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <a
          href={`/events/${id}/results/${simId}`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            background: '#f9fafb',
            color: '#374151',
            textDecoration: 'none',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          ← Résultats
        </a>

        <button
          onClick={() => window.print()}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 16px',
            borderRadius: '6px',
            border: 'none',
            background: '#7CB518',
            color: '#fff',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Imprimer / Exporter PDF
        </button>
      </div>

      {/* A4 Report sheet */}
      <div
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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '0',
          }}
        >
          {/* Brand logo */}
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
            <span
              style={{
                fontSize: '24px',
                fontWeight: 400,
                color: '#111827',
                letterSpacing: '-0.5px',
              }}
            >
              Trail<strong>Sim</strong>
            </span>
          </div>

          {/* Event meta */}
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
            <div
              style={{
                fontSize: '16px',
                fontWeight: 700,
                color: '#111827',
                marginBottom: '4px',
              }}
            >
              {sim.event.name}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              {fmtDate(sim.event.date)}
              {sim.event.location ? ` · ${sim.event.location}` : ''}
            </div>
          </div>
        </div>

        {/* Lime separator */}
        <div
          style={{
            height: '2.5px',
            background: '#7CB518',
            marginTop: '18px',
            marginBottom: '28px',
            borderRadius: '2px',
          }}
        />

        {/* ── Section: RÉSUMÉ ── */}
        <SectionTitle>RÉSUMÉ</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '32px',
          }}
        >
          <StatCard value={String(totalRunners)} label="Total coureurs" />
          <StatCard value={String(totalCourses)} label="Courses" />
          <StatCard value={String(riskZoneCount)} label="Zones à risque" />
          <StatCard value={`${avgAbandon}%`} label="Taux d'abandon moy." />
        </div>

        {/* ── Section: ZONES À RISQUE ── */}
        <SectionTitle>ZONES À RISQUE</SectionTitle>
        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse',
            marginBottom: '32px',
            fontSize: '12px',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '2px solid #f3f4f6' }}>
              {['Zone', 'Score', 'Prob. bouchon', 'Densité max', 'Course'].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: 'left',
                    padding: '6px 10px',
                    fontWeight: 600,
                    color: '#6b7280',
                    fontSize: '11px',
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
            {riskZones.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  style={{ padding: '16px 10px', color: '#9ca3af', textAlign: 'center' }}
                >
                  Aucune donnée de risque disponible
                </td>
              </tr>
            ) : (
              riskZones.map((zone, i) => {
                const race = parsedRaces.find((r) => r.id === zone.raceId)
                const kmPos =
                  race?.gpxPoints?.[zone.segmentIndex]?.dist?.toFixed(1) ?? '—'
                const color = scoreColor(zone.riskScore)
                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: i % 2 === 0 ? '#fff' : '#fafafa',
                    }}
                  >
                    <td style={{ padding: '8px 10px', color: '#374151' }}>
                      Seg. {zone.segmentIndex + 1}
                      <span style={{ color: '#9ca3af', marginLeft: '4px' }}>
                        ({kmPos} km)
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontWeight: 700,
                          color,
                        }}
                      >
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '50%',
                            background: color,
                            display: 'inline-block',
                          }}
                        />
                        {zone.riskScore.toFixed(0)}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151' }}>
                      {(zone.jamProbability * 100).toFixed(0)}%
                    </td>
                    <td style={{ padding: '8px 10px', color: '#374151' }}>
                      {zone.peakDensity.toFixed(2)}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {race ? (
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '11px',
                          }}
                        >
                          <span
                            style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              background: race.color,
                              display: 'inline-block',
                              flexShrink: 0,
                            }}
                          />
                          {race.name}
                        </span>
                      ) : (
                        <span style={{ color: '#9ca3af' }}>—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>

        {/* ── Section: FENÊTRES DE COLLISION ── */}
        <SectionTitle>FENÊTRES DE COLLISION</SectionTitle>
        <div style={{ marginBottom: '32px' }}>
          {!result || result.collisionWindows.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>
              Aucune fenêtre de collision détectée.
            </p>
          ) : (
            result.collisionWindows.map((cw, i) => {
              const cwRaces = cw.raceIds
                .map((rid) => parsedRaces.find((r) => r.id === rid))
                .filter(Boolean) as typeof parsedRaces
              return (
                <div
                  key={i}
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
                  {/* Race tags */}
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
                        <span
                          style={{
                            width: '7px',
                            height: '7px',
                            borderRadius: '50%',
                            background: r.color,
                            display: 'inline-block',
                          }}
                        />
                        {r.name}
                      </span>
                    ))}
                  </div>
                  {/* Time window */}
                  <span style={{ color: '#374151', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {fmtTime(cw.tStart)} – {fmtTime(cw.tEnd)}
                  </span>
                  {/* Peak */}
                  <span
                    style={{
                      color: '#D97706',
                      fontWeight: 700,
                      fontSize: '12px',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    pic {cw.peak.toFixed(2)}
                  </span>
                </div>
              )
            })
          )}
        </div>

        {/* ── Section: PROFILS COUREURS ── */}
        <SectionTitle>PROFILS COUREURS</SectionTitle>
        <div style={{ marginBottom: '32px' }}>
          {sim.runnerProfiles.length === 0 ? (
            <p style={{ color: '#9ca3af', fontSize: '13px' }}>Aucun profil configuré.</p>
          ) : (
            sim.runnerProfiles.map((profile) => (
              <div
                key={profile.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '10px',
                }}
              >
                <span
                  style={{
                    minWidth: '120px',
                    fontSize: '12px',
                    fontWeight: 600,
                    color: '#374151',
                  }}
                >
                  {profile.label}
                </span>
                <div
                  style={{
                    flex: 1,
                    background: '#f3f4f6',
                    borderRadius: '4px',
                    height: '14px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, profile.percentage)}%`,
                      height: '100%',
                      background: profile.color,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
                <span
                  style={{
                    minWidth: '38px',
                    textAlign: 'right',
                    fontSize: '12px',
                    fontWeight: 700,
                    color: '#374151',
                  }}
                >
                  {profile.percentage.toFixed(0)}%
                </span>
              </div>
            ))
          )}
        </div>

        {/* ── Section: CONDITIONS ── */}
        <SectionTitle>CONDITIONS</SectionTitle>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginBottom: '40px',
          }}
        >
          <CondCard label="Température" value={`${sim.temperature}°C`} />
          <CondCard label="Vent" value={`${sim.wind} km/h`} />
          <CondCard label="Pluie" value={sim.rain ? `Oui · ${sim.rainIntensity} mm/h` : 'Non'} />
          <CondCard label="Brouillard" value={sim.fog ? 'Oui' : 'Non'} />
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
          <span>Page 1</span>
          <span>Généré par TrailSim · trailsim.fr</span>
        </div>
      </div>
    </div>
  )
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

function StatCard({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '14px 12px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: "'JetBrains Mono', 'Fira Mono', 'Courier New', monospace",
          fontSize: '26px',
          fontWeight: 700,
          color: '#111827',
          lineHeight: 1.1,
          marginBottom: '6px',
        }}
      >
        {value}
      </div>
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500 }}>{label}</div>
    </div>
  )
}

function CondCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: '10px',
        padding: '12px',
        textAlign: 'center',
      }}
    >
      <div style={{ fontSize: '11px', color: '#6b7280', fontWeight: 500, marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  )
}
