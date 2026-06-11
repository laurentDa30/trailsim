'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  UsersIcon,
  HandshakeIcon,
  PlusIcon,
  Trash2Icon,
  LinkIcon,
  CheckIcon,
} from 'lucide-react'

interface Member {
  id: string
  name: string
  email: string | null
  phone: string | null
  role: string
  status: string
  inviteToken: string
  note: string | null
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

export function EquipeView({ event, initialMembers, initialPartners, canEdit }: EquipeViewProps) {
  const [members, setMembers] = useState<Member[]>(initialMembers)
  const [partners, setPartners] = useState<PartnerRow[]>(initialPartners)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // ── Member form ──
  const [mName, setMName] = useState('')
  const [mEmail, setMEmail] = useState('')
  const [mPhone, setMPhone] = useState('')
  const [mRole, setMRole] = useState('BENEVOLE')
  const [mBusy, setMBusy] = useState(false)

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
        }),
      })
      if (res.ok) {
        const m = (await res.json()) as Member
        setMembers((prev) => [...prev, m])
        setMName('')
        setMEmail('')
        setMPhone('')
      }
    } finally {
      setMBusy(false)
    }
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
    const url = `${window.location.origin}/invite/${m.inviteToken}`
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(m.id)
      setTimeout(() => setCopiedId((cur) => (cur === m.id ? null : cur)), 1600)
    } catch {
      prompt('Copiez le lien d’invitation :', url)
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
          sub={`${members.length} membre${members.length > 1 ? 's' : ''} — chaque membre reçoit un lien d’invitation à partager (WhatsApp, SMS, email)`}
        >
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
              Aucun membre pour l’instant. Ajoutez vos co-organisateurs et bénévoles : ils pourront
              accéder à l’événement (lecture pour les bénévoles, gestion pour les organisateurs) en
              réclamant leur lien d’invitation.
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
                        title="Copier le lien d’invitation"
                        className="flex items-center gap-1 px-2 py-1 rounded text-[11px] shrink-0"
                        style={{
                          background: 'var(--color-bg-1)',
                          border: '1px solid var(--color-line)',
                          color: copiedId === m.id ? 'var(--color-safe)' : 'var(--color-ink-3)',
                        }}
                      >
                        {copiedId === m.id ? <CheckIcon size={12} /> : <LinkIcon size={12} />}
                        {copiedId === m.id ? 'Copié' : 'Inviter'}
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
