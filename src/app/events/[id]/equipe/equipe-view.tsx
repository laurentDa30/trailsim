'use client'

import { useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  UserCogIcon,
  HandshakeIcon,
  PlusIcon,
  Trash2Icon,
  LinkIcon,
  CheckIcon,
  RotateCcwIcon,
  FolderIcon,
  PieChartIcon,
} from 'lucide-react'

interface Member {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  status: string
  inviteToken: string
  raceIds: string[]
  sectionId: string | null
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

interface SectionRow {
  id: string
  name: string
  color: string
  responsibleId: string | null
}

interface EquipeViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  owner: { name: string | null; email: string }
  races: RaceRef[]
  initialMembers: Member[]
  initialPartners: PartnerRow[]
  initialSections: SectionRow[]
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

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }).format(
    new Date(iso)
  )
}

export function EquipeView({
  event,
  owner,
  races,
  initialMembers,
  initialPartners,
  initialSections,
  canEdit,
}: EquipeViewProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [sections, setSections] = useState<SectionRow[]>(initialSections)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ── Member form ──
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mRole, setMRole] = useState('BENEVOLE')
  const [mBusy, setMBusy] = useState(false)

  // ── Section form ──
  const [sName, setSName] = useState('')
  const [sBusy, setSBusy] = useState(false)

  // ── Partner form ──
  const [pName, setPName] = useState('')
  const [pKind, setPKind] = useState('SPONSOR')
  const [pContact, setPContact] = useState('')
  const [pPhone, setPPhone] = useState('')
  const [pBusy, setPBusy] = useState(false)

  const organisers = useMemo(() => members.filter((m) => m.role === 'ORGANISATEUR'), [members])
  const volunteers = useMemo(() => members.filter((m) => m.role === 'BENEVOLE'), [members])
  const sectionIds = useMemo(() => new Set(sections.map((s) => s.id)), [sections])
  const volunteersBySection = useMemo(() => {
    const map = new Map<string, Member[]>()
    for (const m of volunteers) {
      if (m.sectionId && sectionIds.has(m.sectionId)) {
        if (!map.has(m.sectionId)) map.set(m.sectionId, [])
        map.get(m.sectionId)!.push(m)
      }
    }
    return map
  }, [volunteers, sectionIds])
  const unassignedVolunteers = useMemo(
    () => volunteers.filter((m) => !m.sectionId || !sectionIds.has(m.sectionId)),
    [volunteers, sectionIds]
  )
  const memberName = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of members) m.set(x.id, x.name)
    return m
  }, [members])
  const raceCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const m of members) for (const rid of m.raceIds) counts.set(rid, (counts.get(rid) ?? 0) + 1)
    return counts
  }, [members])

  // ── Member handlers ──
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
        }),
      })
      if (res.ok) {
        const raw = (await res.json()) as Omit<Member, 'raceIds'> & { raceIds: string }
        setMembers((prev) => [...prev, { ...raw, raceIds: JSON.parse(raw.raceIds || '[]'), sectionId: raw.sectionId ?? null }])
        setMName('')
        setMEmail('')
        setMPhone('')
      }
    } finally {
      setMBusy(false)
    }
  }

  function patchMember(id: string, body: Record<string, unknown>) {
    return fetch(`/api/events/${event.id}/members/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  function toggleMemberRace(m: Member, raceId: string) {
    const next = m.raceIds.includes(raceId)
      ? m.raceIds.filter((r) => r !== raceId)
      : [...m.raceIds, raceId]
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, raceIds: next } : x)))
    patchMember(m.id, { raceIds: next })
  }

  function setMemberRole(id: string, role: string) {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role, sectionId: role === 'ORGANISATEUR' ? null : m.sectionId } : m)))
    patchMember(id, { role, ...(role === 'ORGANISATEUR' ? { sectionId: null } : {}) })
  }

  function setMemberSection(m: Member, sectionId: string | null) {
    setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, sectionId } : x)))
    patchMember(m.id, { sectionId })
  }

  async function removeMember(id: string) {
    if (!confirm('Retirer ce membre de l’événement ?')) return
    setMembers((prev) => prev.filter((m) => m.id !== id))
    await fetch(`/api/events/${event.id}/members/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function copyInvite(m: Member) {
    const path = m.role === 'ORGANISATEUR' ? 'invite' : 'b'
    const url = `${window.location.origin}/${path}/${m.inviteToken}`
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
    const res = await fetch(`/api/events/${event.id}/members/${m.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regenerateToken: true }),
    }).catch(() => null)
    if (res && res.ok) {
      const updated = (await res.json()) as Member
      setMembers((prev) => prev.map((x) => (x.id === m.id ? { ...x, inviteToken: updated.inviteToken } : x)))
    }
  }

  // ── Section handlers ──
  async function addSection(e: React.FormEvent) {
    e.preventDefault()
    if (!sName.trim() || sBusy) return
    setSBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/sections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: sName.trim() }),
      })
      if (res.ok) {
        const s = (await res.json()) as SectionRow
        setSections((prev) => [...prev, s])
        setSName('')
      }
    } finally {
      setSBusy(false)
    }
  }

  function setSectionResponsible(id: string, responsibleId: string | null) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, responsibleId } : s)))
    fetch(`/api/events/${event.id}/sections/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responsibleId }),
    }).catch(() => {})
  }

  async function removeSection(id: string) {
    if (!confirm('Supprimer ce pôle ? Les bénévoles rattachés seront détachés.')) return
    setSections((prev) => prev.filter((s) => s.id !== id))
    setMembers((prev) => prev.map((m) => (m.sectionId === id ? { ...m, sectionId: null } : m)))
    await fetch(`/api/events/${event.id}/sections/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  // ── Partner handlers ──
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

  // ── Reusable member row ──
  function MemberRow({ m, accent }: { m: Member; accent: string }) {
    return (
      <div
        className="flex flex-col gap-1.5 rounded-lg px-3 py-2"
        style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderLeft: `3px solid ${accent}` }}
      >
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>
                {m.name}
              </span>
              <span
                className="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0"
                style={
                  m.status === 'ACTIF'
                    ? { color: 'var(--color-safe)', background: 'color-mix(in oklab, var(--color-safe) 14%, transparent)' }
                    : { color: 'var(--color-ink-4)', background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }
                }
              >
                {m.status === 'ACTIF' ? 'Actif' : 'Invité'}
              </span>
            </div>
            <div className="text-[10.5px] truncate" style={{ color: 'var(--color-ink-4)' }}>
              {[m.email, m.phone].filter(Boolean).join(' · ') || '—'}
            </div>
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
                title="Copier le lien d’accès personnel"
                className="flex items-center gap-1 px-2 py-1 rounded text-[11px] shrink-0"
                style={{
                  background: 'var(--color-bg-1)',
                  border: '1px solid var(--color-line)',
                  color: copiedId === m.id ? 'var(--color-safe)' : 'var(--color-ink-3)',
                }}
              >
                {copiedId === m.id ? <CheckIcon size={12} /> : <LinkIcon size={12} />}
                {copiedId === m.id ? 'Copié' : 'Lien'}
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

        {/* Race assignment + (volunteers) section assignment */}
        {(races.length > 0 || (canEdit && m.role === 'BENEVOLE')) && (
          <div className="flex flex-wrap items-center gap-1">
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
                    background: active ? `color-mix(in oklab, ${r.color} 18%, transparent)` : 'var(--color-bg-1)',
                    border: `1px solid ${active ? r.color : 'var(--color-line)'}`,
                    color: active ? 'var(--color-ink)' : 'var(--color-ink-4)',
                    cursor: canEdit ? 'pointer' : 'default',
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: r.color }} />
                  {r.name}
                </button>
              )
            })}
            {canEdit && m.role === 'BENEVOLE' && sections.length > 0 && (
              <select
                value={m.sectionId && sectionIds.has(m.sectionId) ? m.sectionId : ''}
                onChange={(e) => setMemberSection(m, e.target.value || null)}
                className="ml-auto px-1.5 py-0.5 rounded text-[10px]"
                style={inputStyle}
                title="Pôle"
              >
                <option value="">— Sans pôle —</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            )}
          </div>
        )}
      </div>
    )
  }

  function StatRow({ label, value, color }: { label: string; value: number | string; color?: string }) {
    return (
      <div className="flex items-center justify-between text-xs">
        <span style={{ color: 'var(--color-ink-3)' }}>{label}</span>
        <span className="font-mono font-semibold tabular-nums" style={{ color: color ?? 'var(--color-ink)' }}>
          {value}
        </span>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <Topbar
        activePage="equipe"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        eventDate={event.date ? fmtDate(event.date) : undefined}
      />

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ── Management (left) ── */}
        <div className="flex-1 min-w-0 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Add member */}
          {canEdit && (
            <form
              onSubmit={addMember}
              className="flex flex-wrap gap-2 rounded-xl p-3"
              style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
            >
              <input value={mName} onChange={(e) => setMName(e.target.value)} placeholder="Nom *" required className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
              <input value={mEmail} onChange={(e) => setMEmail(e.target.value)} placeholder="Email" type="email" className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
              <input value={mPhone} onChange={(e) => setMPhone(e.target.value)} placeholder="Téléphone" className="w-32 px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
              <select value={mRole} onChange={(e) => setMRole(e.target.value)} className="px-2 py-1.5 rounded-md text-xs" style={inputStyle}>
                <option value="BENEVOLE">Bénévole</option>
                <option value="ORGANISATEUR">Organisateur</option>
              </select>
              <button type="submit" disabled={mBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
                <PlusIcon size={13} /> Ajouter
              </button>
            </form>
          )}

          {/* Organisers */}
          <section className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-line)' }}>
              <span style={{ color: 'var(--color-lime)' }}><UserCogIcon size={15} /></span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Organisateurs</span>
              <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>{organisers.length + 1} pers. · accès gestion</span>
            </div>
            <div className="p-4 flex flex-col gap-1.5">
              {/* Owner */}
              <div className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', borderLeft: '3px solid var(--color-lime)' }}>
                <div className="min-w-0 flex-1">
                  <span className="text-xs font-medium" style={{ color: 'var(--color-ink)' }}>{owner.name || owner.email}</span>
                  <div className="text-[10.5px]" style={{ color: 'var(--color-ink-4)' }}>{owner.email}</div>
                </div>
                <span className="text-[11px] shrink-0" style={{ color: 'var(--color-lime)' }}>Propriétaire</span>
              </div>
              {organisers.map((m) => (
                <MemberRow key={m.id} m={m} accent="var(--color-lime)" />
              ))}
            </div>
          </section>

          {/* Sections (pôles) */}
          <section className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-line)' }}>
              <span style={{ color: 'var(--color-lime)' }}><FolderIcon size={15} /></span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Pôles &amp; bénévoles</span>
              <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>{sections.length} pôle{sections.length > 1 ? 's' : ''} · {volunteers.length} bénévole{volunteers.length > 1 ? 's' : ''}</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {canEdit && (
                <form onSubmit={addSection} className="flex gap-2">
                  <input value={sName} onChange={(e) => setSName(e.target.value)} placeholder="Nouveau pôle (retrait dossards, buvette, balisage…)" className="flex-1 px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
                  <button type="submit" disabled={sBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
                    <PlusIcon size={13} /> Pôle
                  </button>
                </form>
              )}

              {sections.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
                  Aucun pôle. Créez des pôles (retrait dossards, buvette, balisage, secours…), confiez chacun à un organisateur, puis rattachez-y des bénévoles.
                </p>
              )}

              {sections.map((s) => {
                const vols = volunteersBySection.get(s.id) ?? []
                return (
                  <div key={s.id} className="rounded-lg" style={{ border: '1px solid var(--color-line)' }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--color-line)' }}>
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                      <span className="text-xs font-semibold" style={{ color: 'var(--color-ink)' }}>{s.name}</span>
                      <span className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>{vols.length} bénévole{vols.length > 1 ? 's' : ''}</span>
                      <div className="flex-1" />
                      {canEdit ? (
                        <select
                          value={s.responsibleId && memberName.has(s.responsibleId) ? s.responsibleId : ''}
                          onChange={(e) => setSectionResponsible(s.id, e.target.value || null)}
                          className="px-1.5 py-1 rounded text-[10.5px] max-w-[150px]"
                          style={inputStyle}
                          title="Responsable du pôle"
                        >
                          <option value="">— Responsable —</option>
                          {organisers.map((o) => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      ) : (
                        s.responsibleId && memberName.has(s.responsibleId) && (
                          <span className="text-[10.5px]" style={{ color: 'var(--color-ink-3)' }}>
                            Resp. {memberName.get(s.responsibleId)}
                          </span>
                        )
                      )}
                      {canEdit && (
                        <button type="button" onClick={() => removeSection(s.id)} aria-label="Supprimer le pôle" className="p-1 rounded shrink-0" style={{ color: 'var(--color-danger, #DC2626)' }}>
                          <Trash2Icon size={13} />
                        </button>
                      )}
                    </div>
                    <div className="p-2 flex flex-col gap-1.5">
                      {vols.length === 0 ? (
                        <p className="text-[11px] px-1" style={{ color: 'var(--color-ink-4)' }}>Aucun bénévole rattaché.</p>
                      ) : (
                        vols.map((m) => <MemberRow key={m.id} m={m} accent={s.color} />)
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Unassigned volunteers */}
              {unassignedVolunteers.length > 0 && (
                <div className="rounded-lg" style={{ border: '1px solid color-mix(in oklab, var(--color-warning) 30%, var(--color-line))' }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: '1px solid var(--color-line)' }}>
                    <span className="text-xs font-semibold" style={{ color: 'var(--color-warning)' }}>Bénévoles sans pôle</span>
                    <span className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>{unassignedVolunteers.length}</span>
                  </div>
                  <div className="p-2 flex flex-col gap-1.5">
                    {unassignedVolunteers.map((m) => <MemberRow key={m.id} m={m} accent="var(--color-warning)" />)}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Partners */}
          <section className="rounded-xl overflow-hidden" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-line)' }}>
              <span style={{ color: 'var(--color-lime)' }}><HandshakeIcon size={15} /></span>
              <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Partenaires</span>
              <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>{partners.length} — sponsors, mairie, secours, presse…</span>
            </div>
            <div className="p-4 flex flex-col gap-3">
              {canEdit && (
                <form onSubmit={addPartner} className="flex flex-wrap gap-2">
                  <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nom *" required className="flex-1 min-w-[140px] px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
                  <select value={pKind} onChange={(e) => setPKind(e.target.value)} className="px-2 py-1.5 rounded-md text-xs" style={inputStyle}>
                    {PARTNER_KINDS.map((k) => (<option key={k.value} value={k.value}>{k.label}</option>))}
                  </select>
                  <input value={pContact} onChange={(e) => setPContact(e.target.value)} placeholder="Contact" className="flex-1 min-w-[120px] px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
                  <input value={pPhone} onChange={(e) => setPPhone(e.target.value)} placeholder="Téléphone" className="w-32 px-2.5 py-1.5 rounded-md text-xs" style={inputStyle} />
                  <button type="submit" disabled={pBusy} className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
                    <PlusIcon size={13} /> Ajouter
                  </button>
                </form>
              )}
              {partners.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>Aucun partenaire enregistré.</p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {partners.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium truncate" style={{ color: 'var(--color-ink)' }}>{p.name}</span>
                          <span className="px-1.5 py-0.5 rounded text-[10px] shrink-0" style={{ color: 'var(--color-ink-3)', background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
                            {PARTNER_KINDS.find((k) => k.value === p.kind)?.label ?? p.kind}
                          </span>
                        </div>
                        <div className="text-[10.5px] truncate" style={{ color: 'var(--color-ink-4)' }}>
                          {[p.contactName, p.email, p.phone].filter(Boolean).join(' · ') || '—'}
                        </div>
                      </div>
                      {canEdit && (
                        <button type="button" onClick={() => removePartner(p.id)} aria-label="Supprimer" className="p-1 rounded shrink-0" style={{ color: 'var(--color-danger, #DC2626)' }}>
                          <Trash2Icon size={13} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>

        {/* ── Synthesis (right) ── */}
        <aside
          className="w-full lg:w-[320px] shrink-0 overflow-y-auto p-4 flex flex-col gap-4 border-t lg:border-t-0 lg:border-l"
          style={{ background: 'var(--color-bg-1)', borderColor: 'var(--color-line)' }}
        >
          <div className="flex items-center gap-2">
            <span style={{ color: 'var(--color-lime)' }}><PieChartIcon size={15} /></span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Synthèse</span>
          </div>

          <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}>
            <StatRow label="Organisateurs" value={organisers.length + 1} color="var(--color-lime)" />
            <StatRow label="Bénévoles" value={volunteers.length} />
            <StatRow label="Pôles" value={sections.length} />
            <StatRow label="Bénévoles sans pôle" value={unassignedVolunteers.length} color={unassignedVolunteers.length > 0 ? 'var(--color-warning)' : undefined} />
            <StatRow label="Partenaires" value={partners.length} />
          </div>

          {sections.length > 0 && (
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>Par pôle</span>
              {sections.map((s) => {
                const vols = volunteersBySection.get(s.id) ?? []
                const resp = s.responsibleId ? memberName.get(s.responsibleId) : null
                return (
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.color }} />
                    <span className="truncate" style={{ color: 'var(--color-ink-2)' }}>{s.name}</span>
                    {resp && <span className="text-[10px] truncate" style={{ color: 'var(--color-ink-4)' }}>· {resp}</span>}
                    <span className="ml-auto font-mono tabular-nums" style={{ color: 'var(--color-ink)' }}>{vols.length}</span>
                  </div>
                )
              })}
            </div>
          )}

          {races.length > 0 && (
            <div className="rounded-lg p-3 flex flex-col gap-2" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}>
              <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>Par course</span>
              {races.map((r) => (
                <div key={r.id} className="flex items-center gap-2 text-xs">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: r.color }} />
                  <span className="truncate" style={{ color: 'var(--color-ink-2)' }}>{r.name}</span>
                  <span className="ml-auto font-mono tabular-nums" style={{ color: (raceCounts.get(r.id) ?? 0) > 0 ? 'var(--color-lime)' : 'var(--color-ink-4)' }}>
                    {raceCounts.get(r.id) ?? 0}
                  </span>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
