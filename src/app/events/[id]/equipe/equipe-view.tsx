'use client'

import { useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  UsersIcon,
  HandshakeIcon,
  PlusIcon,
  Trash2Icon,
  LinkIcon,
  CheckIcon,
  RotateCcwIcon,
  NetworkIcon,
} from 'lucide-react'

/** One indented tree branch: a coloured node line + its children. */
function TreeBranch({
  label,
  color,
  count,
  children,
}: {
  label: string
  color: string
  count?: number
  children: React.ReactNode
}) {
  return (
    <div className="ml-2 pl-3" style={{ borderLeft: '1px solid var(--color-line)' }}>
      <div className="flex items-center gap-2 py-1">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        <span className="font-medium" style={{ color: 'var(--color-ink-2)' }}>
          {label}
        </span>
        {count != null && (
          <span className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>
            {count} pers.
          </span>
        )}
      </div>
      <div className="ml-1 pl-3 flex flex-col" style={{ borderLeft: '1px solid var(--color-line)' }}>
        {children}
      </div>
    </div>
  )
}

function TreeLeaf({
  name,
  detail,
  strong,
  muted,
}: {
  name: string
  detail?: string
  strong?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex items-baseline gap-2 py-0.5">
      <span
        className="truncate"
        style={{
          color: muted ? 'var(--color-ink-4)' : 'var(--color-ink)',
          fontWeight: strong ? 600 : 400,
          fontStyle: muted ? 'italic' : 'normal',
        }}
      >
        {name}
      </span>
      {detail && (
        <span className="text-[10px] shrink-0" style={{ color: 'var(--color-ink-4)' }}>
          {detail}
        </span>
      )}
    </div>
  )
}

interface Member {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  status: string
  inviteToken: string
  raceIds: string[]
  note: string | null
}

interface RaceRef {
  id: string
  name: string
  color: string
  distance: number
}

interface PartnerRow {
  id: string
  name: string
  kind: string
  contactName: string | null
  email: string | null
  phone: string | null
  note: string | null
}

interface EquipeViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  owner: { name: string | null; email: string }
  races: RaceRef[]
  initialMembers: Member[]
  initialPartners: PartnerRow[]
  canEdit: boolean
}

const ROLE_LABELS: Record<string, string> = {
  ORGANISATEUR: 'Organisateur',
  BENEVOLE: 'Bénévole',
}

const PARTNER_KINDS = [
  { value: 'SPONSOR', label: 'Sponsor' },
  { value: 'INSTITUTION', label: 'Institution' },
  { value: 'SECOURS', label: 'Secours' },
  { value: 'PRESSE', label: 'Presse' },
  { value: 'AUTRE', label: 'Autre' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink)',
}

function SectionCard({
  icon,
  title,
  sub,
  children,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
    >
      <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-line)' }}>
        <span style={{ color: 'var(--color-lime)' }}>{icon}</span>
        <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
          {title}
        </span>
        <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
          {sub}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function EquipeView({ event, owner, races, initialMembers, initialPartners, canEdit }: EquipeViewProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ── Member form ──
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mRole, setMRole] = useState('BENEVOLE')
  const [mRaces, setMRaces] = useState<Set<string>>(new Set())
  const [mBusy, setMBusy] = useState(false)

  // Headcount per course (how the team is spread over the traces)
  const raceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of members) {
      for (const rid of m.raceIds) counts.set(rid, (counts.get(rid) ?? 0) + 1)
    }
    return counts
  }, [members])

  const unassigned = useMemo(() => members.filter((m) => m.raceIds.length === 0), [members])

  // ── Partner form ──
  const [pName, setPName] = useState('')
  const [pKind, setPKind] = useState('SPONSOR')
  const [pContact, setPContact] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [pBusy, setPBusy] = useState(false)

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    if (!mName.trim() || mBusy) return
    setMBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: mName.trim(),
          email: mEmail.trim() || null,
          phone: mPhone.trim() || null,
          role: mRole,
          raceIds: [...mRaces],
        }),
      })
      if (res.ok) {
        const raw = (await res.json()) as Omit<Member, 'raceIds'> & { raceIds: string }
        setMembers((prev) => [...prev, { ...raw, raceIds: JSON.parse(raw.raceIds || '[]') }])
        setMName('')
        setMEmail('')
        setMPhone('')
        setMRaces(new Set())
      }
    } finally {
      setMBusy(false)
    }
  }

  async function toggleMemberRace(m: Member, raceId: string) {
    const next = m.raceIds.includes(raceId)
      ? m.raceIds.filter((r) => r !== raceId)
      : [...m.raceIds, raceId]
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, raceIds: next } : x)))
    await fetch(`/api/events/${event.id}/members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ raceIds: next }),
    }).catch(() => {})
  }

  async function setMemberRole(id: string, role: string) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
    await fetch(`/api/events/${event.id}/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    }).catch(() => {})
  }

  async function removeMember(id: string) {
    if (!confirm('Retirer ce membre de l’événement ?')) return
    setMembers((prev) => prev.filter((m) => m.id !== id))
    await fetch(`/api/events/${event.id}/members/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function copyInvite(m: Member) {
    // The personal access link: opens the volunteer view directly, no account
    // needed (the page offers an optional sign-up / organiser claim).
    const url = `${window.location.origin}/b/${m.inviteToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(m.id)
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1600)
    } catch {
      prompt('Copiez le lien d’accès :', url)
    }
  }

  async function regenerateLink(m: Member) {
    if (!confirm(`Régénérer le lien de ${m.name} ? L’ancien lien ne fonctionnera plus.`)) return
    try {
      const res = await fetch(`/api/events/${event.id}/members/${m.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerateToken: true }),
      })
      if (res.ok) {
        const updated = (await res.json()) as Member
        setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, inviteToken: updated.inviteToken } : x)))
      }
    } catch {
      /* ignore */
    }
  }

  async function addPartner(e: React.FormEvent) {
    e.preventDefault()
    if (!pName.trim() || pBusy) return
    setPBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/partners`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pName.trim(),
          kind: pKind,
          contactName: pContact.trim() || null,
          phone: pPhone.trim() || null,
        }),
      })
      if (res.ok) {
        const p = (await res.json()) as PartnerRow
        setPartners((prev) => [...prev, p])
        setPName('')
        setPContact('')
        setPPhone('')
      }
    } finally {
      setPBusy(false)
    }
  }

  async function removePartner(id: string) {
    if (!confirm('Supprimer ce partenaire ?')) return
    setPartners((prev) => prev.filter((p) => p.id !== id))
    await fetch(`/api/events/${event.id}/partners/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <Topbar
        activePage="equipe"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        eventDate={
          event.date
            ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
                new Date(event.date)
              )
            : undefined
        }
      />

      <main className="flex-1 w-full max-w-4xl mx-auto p-4 flex flex-col gap-4">
        <SectionCard
          icon={<UsersIcon size={15} />}
          title="Équipe"
          sub={`${members.length} membre${members.length > 1 ? 's' : ''} — chaque membre a un lien d’accès personnel à partager (WhatsApp, SMS) : aucun compte requis pour les bénévoles`}
        >
          {/* Headcount spread over the traces */}
          {races.length > 0 && members.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider mr-1" style={{ color: 'var(--color-ink-4)' }}>
                Répartition
              </span>
              {races.map((r) => (
                <span
                  key={r.id}
                  className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px]"
                  style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  {r.name}
                  <strong style={{ color: (raceCounts.get(r.id) ?? 0) > 0 ? 'var(--color-lime)' : 'var(--color-ink-4)' }}>
                    {raceCounts.get(r.id) ?? 0}
                  </strong>
                </span>
              ))}
              {unassigned.length > 0 && (
                <span
                  className="px-2 py-0.5 rounded-full text-[11px]"
                  style={{
                    color: 'var(--color-warning)',
                    background: 'color-mix(in oklab, var(--color-warning) 10%, transparent)',
                    border: '1px solid color-mix(in oklab, var(--color-warning) 30%, transparent)',
                  }}
                >
                  {unassigned.length} non affecté{unassigned.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          {canEdit && (
            <form onSubmit={addMember} className="flex flex-wrap gap-2 mb-3">
              <input
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                placeholder="Nom *"
                required
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <input
                value={mEmail}
                onChange={(e) => setMEmail(e.target.value)}
                placeholder="Email"
                type="email"
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <input
                value={mPhone}
                onChange={(e) => setMPhone(e.target.value)}
                placeholder="Téléphone"
                className="w-32 px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <select
                value={mRole}
                onChange={(e) => setMRole(e.target.value)}
                className="px-2 py-1.5 rounded-md text-xs"
                style={inputStyle}
              >
                <option value="BENEVOLE">Bénévole</option>
                <option value="ORGANISATEUR">Organisateur</option>
              </select>
              {races.length > 0 && (
                <div className="w-full flex flex-wrap items-center gap-1.5">
                  <span className="text-[10.5px]" style={{ color: 'var(--color-ink-4)' }}>
                    Positionné sur :
                  </span>
                  {races.map((r) => {
                    const active = mRaces.has(r.id)
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() =>
                          setMRaces((prev) => {
                            const next = new Set(prev)
                            if (next.has(r.id)) next.delete(r.id)
                            else next.add(r.id)
                            return next
                          })
                        }
                        className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] transition-colors"
                        style={{
                          background: active
                            ? `color-mix(in oklab, ${r.color} 18%, transparent)`
                            : 'var(--color-bg-2)',
                          border: `1px solid ${active ? r.color : 'var(--color-line)'}`,
                          color: active ? 'var(--color-ink)' : 'var(--color-ink-3)',
                        }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                        {r.name}
                      </button>
                    )
                  })}
                </div>
              )}
              <button
                type="submit"
                disabled={mBusy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{
                  background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)',
                  color: 'var(--color-lime)',
                  border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)',
                }}
              >
                <PlusIcon size={13} /> Ajouter
              </button>
            </form>
          )}

          {members.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
              Aucun membre pour l’instant. Ajoutez vos co-organisateurs et bénévoles, puis
              partagez-leur leur lien d’accès personnel : les bénévoles y voient l’événement
              directement, sans créer de compte ; les organisateurs créent un compte pour accéder à
              la gestion.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                        {m.name}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                        style={
                          m.status === 'ACTIF'
                            ? {
                                color: 'var(--color-safe)',
                                background: 'color-mix(in oklab, var(--color-safe) 14%, transparent)',
                              }
                            : {
                                color: 'var(--color-ink-4)',
                                background: 'var(--color-bg-1)',
                                border: '1px solid var(--color-line)',
                              }
                        }
                      >
                        {m.status === 'ACTIF' ? 'Actif' : 'Invité'}
                      </span>
                    </div>
                    <div className="text-[10.5px] truncate" style={{ color: 'var(--color-ink-4)' }}>
                      {[m.email, m.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                    {races.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {races.map((r) => {
                          const active = m.raceIds.includes(r.id)
                          if (!canEdit && !active) return null
                          return (
                            <button
                              key={r.id}
                              type="button"
                              disabled={!canEdit}
                              onClick={() => toggleMemberRace(m, r.id)}
                              title={canEdit ? (active ? `Retirer de ${r.name}` : `Affecter à ${r.name}`) : r.name}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] transition-colors"
                              style={{
                                background: active
                                  ? `color-mix(in oklab, ${r.color} 18%, transparent)`
                                  : 'var(--color-bg-1)',
                                border: `1px solid ${active ? r.color : 'var(--color-line)'}`,
                                color: active ? 'var(--color-ink)' : 'var(--color-ink-4)',
                                opacity: active ? 1 : 0.7,
                                cursor: canEdit ? 'pointer' : 'default',
                              }}
                            >
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                              {r.name}
                            </button>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {canEdit ? (
                    <select
                      value={m.role}
                      onChange={(e) => setMemberRole(m.id, e.target.value)}
                      className="px-1.5 py-1 rounded text-[11px] shrink-0"
                      style={inputStyle}
                    >
                      <option value="BENEVOLE">Bénévole</option>
                      <option value="ORGANISATEUR">Organisateur</option>
                    </select>
                  ) : (
                    <span className="text-[11px] shrink-0" style={{ color: 'var(--color-ink-3)' }}>
                      {ROLE_LABELS[m.role] ?? m.role}
                    </span>
                  )}

                  {canEdit && (
                    <>
                      <button
                        type="button"
                        onClick={() => copyInvite(m)}
                        title="Copier le lien d’accès personnel (aucun compte requis pour un bénévole)"
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] shrink-0"
                        style={{
                          background: 'var(--color-bg-1)',
                          border: '1px solid var(--color-line)',
                          color: copiedId === m.id ? 'var(--color-safe)' : 'var(--color-ink-3)',
                        }}
                      >
                        {copiedId === m.id ? <CheckIcon size={12} /> : <LinkIcon size={12} />}
                        {copiedId === m.id ? 'Copié' : 'Lien d’accès'}
                      </button>
                      <button
                        type="button"
                        onClick={() => regenerateLink(m)}
                        title="Régénérer le lien (révoque l’ancien)"
                        aria-label="Régénérer le lien"
                        className="p-1 rounded shrink-0"
                        style={{ color: 'var(--color-ink-4)' }}
                      >
                        <RotateCcwIcon size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        aria-label="Retirer"
                        className="p-1 rounded shrink-0"
                        style={{ color: 'var(--color-danger, #DC2626)' }}
                      >
                        <Trash2Icon size={13} />
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* Geographic tree: who is where, who reports to whom */}
        {(members.length > 0 || races.length > 0) && (
          <SectionCard
            icon={<NetworkIcon size={15} />}
            title="Arbre géographique"
            sub="qui est où, qui dépend de qui"
          >
            <div className="flex flex-col text-xs">
              {/* Root: the event + the organisation */}
              <div className="flex items-center gap-2 py-1" style={{ color: 'var(--color-ink)' }}>
                <span className="font-semibold">{event.name}</span>
              </div>

              {/* Organisation branch */}
              <TreeBranch label="Organisation" color="var(--color-lime)">
                <TreeLeaf
                  name={owner.name || owner.email}
                  detail="Propriétaire"
                  strong
                />
                {members
                  .filter((m) => m.role === 'ORGANISATEUR')
                  .map((m) => (
                    <TreeLeaf
                      key={m.id}
                      name={m.name}
                      detail={`Organisateur${m.status === 'ACTIF' ? '' : ' · invité'}`}
                    />
                  ))}
              </TreeBranch>

              {/* One branch per course: its assigned team, under the organisation */}
              {races.map((r) => {
                const assigned = members.filter((m) => m.raceIds.includes(r.id))
                return (
                  <TreeBranch
                    key={r.id}
                    label={`${r.name}${r.distance > 0 ? ` (${r.distance} km)` : ''}`}
                    color={r.color}
                    count={assigned.length}
                  >
                    {assigned.length === 0 ? (
                      <TreeLeaf name="Personne sur ce tracé" muted />
                    ) : (
                      assigned.map((m) => (
                        <TreeLeaf
                          key={m.id}
                          name={m.name}
                          detail={`${ROLE_LABELS[m.role] ?? m.role}${m.phone ? ` · ${m.phone}` : ''}`}
                        />
                      ))
                    )}
                  </TreeBranch>
                )
              })}

              {/* Unassigned people */}
              {unassigned.length > 0 && (
                <TreeBranch label="Non affectés" color="var(--color-warning)" count={unassigned.length}>
                  {unassigned.map((m) => (
                    <TreeLeaf key={m.id} name={m.name} detail={ROLE_LABELS[m.role] ?? m.role} />
                  ))}
                </TreeBranch>
              )}
            </div>
          </SectionCard>
        )}

        <SectionCard
          icon={<HandshakeIcon size={15} />}
          title="Partenaires"
          sub={`${partners.length} partenaire${partners.length > 1 ? 's' : ''} — sponsors, mairie, secours, presse…`}
        >
          {canEdit && (
            <form onSubmit={addPartner} className="flex flex-wrap gap-2 mb-3">
              <input
                value={pName}
                onChange={(e) => setPName(e.target.value)}
                placeholder="Nom *"
                required
                className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <select
                value={pKind}
                onChange={(e) => setPKind(e.target.value)}
                className="px-2 py-1.5 rounded-md text-xs"
                style={inputStyle}
              >
                {PARTNER_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
              <input
                value={pContact}
                onChange={(e) => setPContact(e.target.value)}
                placeholder="Contact"
                className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <input
                value={pPhone}
                onChange={(e) => setPPhone(e.target.value)}
                placeholder="Téléphone"
                className="w-32 px-2.5 py-1.5 rounded-md text-xs"
                style={inputStyle}
              />
              <button
                type="submit"
                disabled={pBusy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium"
                style={{
                  background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)',
                  color: 'var(--color-lime)',
                  border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)',
                }}
              >
                <PlusIcon size={13} /> Ajouter
              </button>
            </form>
          )}

          {partners.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
              Aucun partenaire enregistré.
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {partners.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2 rounded-lg px-3 py-2"
                  style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                        {p.name}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] shrink-0"
                        style={{
                          color: 'var(--color-ink-3)',
                          background: 'var(--color-bg-1)',
                          border: '1px solid var(--color-line)',
                        }}
                      >
                        {PARTNER_KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}
                      </span>
                    </div>
                    <div className="text-[10.5px] truncate" style={{ color: 'var(--color-ink-4)' }}>
                      {[p.contactName, p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removePartner(p.id)}
                      aria-label="Supprimer"
                      className="p-1 rounded shrink-0"
                      style={{ color: 'var(--color-danger, #DC2626)' }}
                    >
                      <Trash2Icon size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </main>
    </div>
  )
}
