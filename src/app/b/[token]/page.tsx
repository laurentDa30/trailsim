import Link from 'next/link'
import db from '@/lib/db'
import type { GPXPoint } from '@/engine/types'
import { OperationalMap, type OpMapRace } from '../../events/[id]/report/[simId]/operational-map'
import type { PlacedLogi } from '@/lib/logistics'

interface PageProps {
  params: Promise<{ token: string }>
}

function fmtDate(d: Date | null): string | null {
  if (!d) return null
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(d)
  )
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

/**
 * Volunteer view, reached by the personal token link — NO account, no session:
 * the token is the access. Read-only and limited on purpose: event info,
 * courses and the operational map (traces, ravitos, postes). Sensitive data
 * (annuaire, config, exports) stays behind a login.
 */
export default async function VolunteerPage({ params }: PageProps) {
  const { token } = await params

  const member = await db.eventMember.findUnique({
    where: { inviteToken: token },
    include: {
      event: {
        include: {
          races: { include: { segments: true }, orderBy: { startTime: 'asc' } },
          simulations: {
            where: { status: 'DONE' },
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: { id: true, logistique: true },
          },
        },
      },
    },
  })

  if (!member) {
    return (
      <main
        className="min-h-screen flex items-center justify-center p-6"
        style={{ background: 'var(--color-bg)' }}
      >
        <div
          className="max-w-md w-full rounded-xl p-6 text-center"
          style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
        >
          <h1 className="text-base font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>
            Lien invalide
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-ink-3)' }}>
            Ce lien d&apos;accès n&apos;existe pas ou a été régénéré par l&apos;organisateur.
            Demandez-lui votre nouveau lien.
          </p>
        </div>
      </main>
    )
  }

  const event = member.event
  const sim = event.simulations[0] ?? null
  let logistics: PlacedLogi[] = []
  if (sim?.logistique) {
    try {
      logistics = JSON.parse(sim.logistique) as PlacedLogi[]
    } catch {
      logistics = []
    }
  }

  const mapRaces: OpMapRace[] = event.races.map((r) => {
    let gpxPoints: GPXPoint[] = []
    try {
      gpxPoints = JSON.parse(r.gpxPoints) as GPXPoint[]
    } catch {
      gpxPoints = []
    }
    return {
      id: r.id,
      name: r.name,
      color: r.color,
      points: downsample(gpxPoints).map((p) => ({ lat: p.lat, lng: p.lng, dist: p.dist })),
      segments: r.segments.map((s) => {
        const anchor = gpxPoints[s.indexStart]
        const hasCoords = !(s.lat === 0 && s.lng === 0)
        return {
          type: s.type,
          label: s.label,
          lat: hasCoords ? s.lat : anchor?.lat ?? 0,
          lng: hasCoords ? s.lng : anchor?.lng ?? 0,
          dist: anchor?.dist ?? 0,
        }
      }),
    }
  })

  const hasMap = mapRaces.some((r) => r.points.length > 1)
  const isOrganisateur = member.role === 'ORGANISATEUR'

  return (
    <main className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <div className="max-w-3xl mx-auto p-4 flex flex-col gap-4">
        {/* Header */}
        <header
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
        >
          <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-ink-4)' }}>
            Accès {isOrganisateur ? 'organisateur' : 'bénévole'}
          </p>
          <h1 className="text-lg font-semibold leading-tight" style={{ color: 'var(--color-ink)' }}>
            {event.name}
          </h1>
          <p className="text-xs mt-1" style={{ color: 'var(--color-ink-3)' }}>
            {[fmtDate(event.date), event.location, event.startClock ? `départ ${event.startClock}` : null]
              .filter(Boolean)
              .join(' · ') || '—'}
          </p>
          <p className="text-sm mt-3" style={{ color: 'var(--color-ink-2)' }}>
            Bonjour <strong>{member.name}</strong> 👋 — vous faites partie de l&apos;équipe.
          </p>

          {isOrganisateur && member.status !== 'ACTIF' && (
            <div
              className="mt-3 rounded-lg px-3 py-2.5 text-xs"
              style={{
                background: 'color-mix(in oklab, var(--color-warning) 10%, transparent)',
                border: '1px solid color-mix(in oklab, var(--color-warning) 30%, transparent)',
                color: 'var(--color-ink-2)',
              }}
            >
              Vous êtes invité·e comme <strong>organisateur</strong> : créez votre compte pour accéder
              à la gestion complète de l&apos;événement.{' '}
              <Link
                href={`/invite/${member.inviteToken}`}
                className="font-semibold underline"
                style={{ color: 'var(--color-lime)' }}
              >
                Créer mon compte
              </Link>
            </div>
          )}
        </header>

        {/* Courses */}
        <section
          className="rounded-xl p-4"
          style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
        >
          <h2 className="text-sm font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>
            Courses
          </h2>
          {event.races.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
              Aucune course configurée pour l&apos;instant.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {event.races.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs"
                  style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="font-medium" style={{ color: 'var(--color-ink)' }}>
                    {r.name}
                  </span>
                  <span style={{ color: 'var(--color-ink-4)' }}>
                    {r.distance > 0 ? `${r.distance} km` : ''}
                    {r.elevGain > 0 ? ` · ${r.elevGain} m D+` : ''}
                  </span>
                  <span className="ml-auto" style={{ color: 'var(--color-ink-3)' }}>
                    départ T+{r.startTime} min
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Operational map: traces, ravitos, postes */}
        {hasMap && (
          <section
            className="rounded-xl overflow-hidden"
            style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
          >
            <div className="px-4 pt-3 pb-1">
              <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
                Carte de l&apos;événement
              </h2>
              <p className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
                Tracés, ravitaillements et postes placés par l&apos;organisation.
              </p>
            </div>
            <OperationalMap
              simId={sim?.id ?? ''}
              races={mapRaces}
              zones={[]}
              height={420}
              showInventory
              initialLogistics={logistics}
            />
          </section>
        )}

        {/* Optional account, for volunteers who want one */}
        {!isOrganisateur && member.status !== 'ACTIF' && (
          <p className="text-center text-[11px] pb-4" style={{ color: 'var(--color-ink-4)' }}>
            Pas besoin de compte pour accéder à cette page — gardez simplement ce lien.{' '}
            <Link href={`/invite/${member.inviteToken}`} className="underline">
              Créer un compte (facultatif)
            </Link>
          </p>
        )}
      </div>
    </main>
  )
}
