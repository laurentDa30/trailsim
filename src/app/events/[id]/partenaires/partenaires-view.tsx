'use client'

import { useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import { HandshakeIcon, PlusIcon, Trash2Icon, ChevronDownIcon, ChevronRightIcon, BellIcon, WalletIcon } from 'lucide-react'
import {
  PARTNER_KINDS,
  PARTNER_STATUSES,
  PARTNER_CONTRIBUTIONS,
  partnerKindMeta,
  partnerStatusMeta,
} from '@/lib/partners'

interface Interaction {
  id: string
  date: string
  by: string | null
  note: string
}

interface Partner {
  id: string
  name: string
  kind: string
  status: string
  contactName: string | null
  email: string | null
  phone: string | null
  note: string | null
  contributions: string[]
  amount: number | null
  responsibleId: string | null
  nextContactDate: string | null
  wish: string | null
  budgetGainId: string | null
  interactions: Interaction[]
}

interface PartenairesViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  initialPartners: Partner[]
  members: { id: string; name: string }[]
  canEdit: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink)',
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €'
}

function daysUntil(iso: string): number {
  const d = new Date(iso)
  const today = new Date()
  d.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((d.getTime() - today.getTime()) / 86400_000)
}

const FINAL = new Set(['CONFIRME', 'REFUSE'])

export function PartenairesView({ event, initialPartners, members, canEdit }: PartenairesViewProps) {
  const [partners, setPartners] = useState<Partner[]>(initialPartners)

  const memberName = (id: string | null) => (id ? members.find((m) => m.id === id)?.name ?? null : null)

  // Summary
  const wonAmount = partners
    .filter((p) => (p.status === 'ACCEPTE' || p.status === 'CONFIRME') && p.contributions.includes('ARGENT'))
    .reduce((s, p) => s + (p.amount ?? 0), 0)
  const toFollowUp = partners.filter(
    (p) => !FINAL.has(p.status) && p.nextContactDate && daysUntil(p.nextContactDate) <= 0
  ).length

  async function addPartner(name: string, kind: string) {
    const res = await fetch(`/api/events/${event.id}/partners`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, kind }),
    }).catch(() => null)
    if (res && res.ok) {
      const p = (await res.json()) as Partner
      setPartners((prev) => [...prev, { ...p, contributions: p.contributions ?? [], interactions: [] }])
    }
  }

  async function addInteraction(partnerId: string, note: string, by: string | null) {
    const res = await fetch(`/api/events/${event.id}/partners/${partnerId}/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, by }),
    }).catch(() => null)
    if (res && res.ok) {
      const it = (await res.json()) as Interaction
      setPartners((prev) =>
        prev.map((p) => (p.id === partnerId ? { ...p, interactions: [it, ...p.interactions] } : p))
      )
    }
  }

  function removeInteraction(partnerId: string, interactionId: string) {
    setPartners((prev) =>
      prev.map((p) =>
        p.id === partnerId ? { ...p, interactions: p.interactions.filter((i) => i.id !== interactionId) } : p
      )
    )
    fetch(`/api/events/${event.id}/partners/${partnerId}/interactions/${interactionId}`, { method: 'DELETE' }).catch(() => {})
  }

  async function addToBudget(partner: Partner) {
    const res = await fetch(`/api/events/${event.id}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'GAIN', label: partner.name, estimated: partner.amount ?? 0 }),
    }).catch(() => null)
    if (res && res.ok) {
      const gain = (await res.json()) as { id: string }
      patchPartner(partner.id, { budgetGainId: gain.id })
    }
  }

  function patchPartner(id: string, body: Partial<Partner>) {
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, ...body } : p)))
    fetch(`/api/events/${event.id}/partners/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  function removePartner(id: string) {
    if (!confirm('Supprimer ce partenaire ?')) return
    setPartners((prev) => prev.filter((p) => p.id !== id))
    fetch(`/api/events/${event.id}/partners/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Topbar
        activePage="partenaires"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        eventDate={event.date ? new Date(event.date).toLocaleDateString('fr-FR') : undefined}
      />

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: 'var(--color-lime)' }}><HandshakeIcon size={18} /></span>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink)' }}>Partenaires</h1>
        </div>
        <p className="text-xs mb-5" style={{ color: 'var(--color-ink-4)' }}>
          Suivez vos démarches de partenariat : qui contacte qui, la réponse, les relances et les contreparties.
        </p>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Summary label="Partenaires" value={String(partners.length)} />
          <Summary label="Mécénat acquis" value={fmtMoney(wonAmount)} color="var(--color-safe, #16A34A)" />
          <Summary label="À relancer" value={String(toFollowUp)} color={toFollowUp > 0 ? 'var(--color-warning)' : undefined} />
        </div>

        {canEdit && <AddPartnerForm onAdd={addPartner} />}

        {partners.length === 0 ? (
          <p className="text-sm mt-4" style={{ color: 'var(--color-ink-4)' }}>
            Aucun partenaire pour l’instant.{canEdit ? ' Ajoutez votre premier contact ci-dessus.' : ''}
          </p>
        ) : (
          <div className="flex flex-col gap-5 mt-2">
            {PARTNER_STATUSES.map((st) => {
              const rows = partners.filter((p) => p.status === st.value)
              if (rows.length === 0) return null
              return (
                <div key={st.value} className="flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: st.color }}>
                    <span className="w-2 h-2 rounded-full" style={{ background: st.color }} />
                    {st.label} ({rows.length})
                  </div>
                  {rows.map((p) => (
                    <PartnerCard
                      key={p.id}
                      partner={p}
                      canEdit={canEdit}
                      members={members}
                      responsibleName={memberName(p.responsibleId)}
                      onPatch={(b) => patchPartner(p.id, b)}
                      onRemove={() => removePartner(p.id)}
                      onAddInteraction={(note, by) => addInteraction(p.id, note, by)}
                      onRemoveInteraction={(iid) => removeInteraction(p.id, iid)}
                      onAddToBudget={() => addToBudget(p)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
      <div className="text-[11px] mb-1" style={{ color: 'var(--color-ink-4)' }}>{label}</div>
      <div className="font-mono text-base font-semibold" style={{ color: color ?? 'var(--color-ink)' }}>{value}</div>
    </div>
  )
}

/* ── Partner card (module scope + local state → no focus loss on re-render) ── */

function PartnerCard({
  partner,
  canEdit,
  members,
  responsibleName,
  onPatch,
  onRemove,
  onAddInteraction,
  onRemoveInteraction,
  onAddToBudget,
}: {
  partner: Partner
  canEdit: boolean
  members: { id: string; name: string }[]
  responsibleName: string | null
  onPatch: (body: Partial<Partner>) => void
  onRemove: () => void
  onAddInteraction: (note: string, by: string | null) => void
  onRemoveInteraction: (interactionId: string) => void
  onAddToBudget: () => void
}) {
  const [itNote, setItNote] = useState('')
  const [itBy, setItBy] = useState('')
  const canAddToBudget = partner.contributions.includes('ARGENT') && (partner.amount ?? 0) > 0
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(partner.name)
  const [amount, setAmount] = useState(partner.amount != null ? String(partner.amount) : '')
  const [wish, setWish] = useState(partner.wish ?? '')
  const [contactName, setContactName] = useState(partner.contactName ?? '')
  const [email, setEmail] = useState(partner.email ?? '')
  const [phone, setPhone] = useState(partner.phone ?? '')
  const [note, setNote] = useState(partner.note ?? '')

  const kind = partnerKindMeta(partner.kind)
  const hasArgent = partner.contributions.includes('ARGENT')
  const relanceDays = partner.nextContactDate ? daysUntil(partner.nextContactDate) : null
  const overdue = !FINAL.has(partner.status) && relanceDays != null && relanceDays <= 0

  function toggleContribution(v: string) {
    const next = partner.contributions.includes(v)
      ? partner.contributions.filter((c) => c !== v)
      : [...partner.contributions, v]
    onPatch({ contributions: next })
  }

  return (
    <div
      className="rounded-lg px-3 py-2.5 flex flex-col gap-2"
      style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
    >
      {/* Line 1: name · kind · status · delete */}
      <div className="flex items-center gap-2 flex-wrap">
        {canEdit ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { const v = name.trim(); if (v && v !== partner.name) onPatch({ name: v }); else if (!v) setName(partner.name) }}
            className="text-sm font-semibold rounded px-1.5 py-0.5 min-w-[140px] flex-1"
            style={{ ...inputStyle, background: 'transparent', borderColor: 'transparent' }}
          />
        ) : (
          <span className="text-sm font-semibold flex-1" style={{ color: 'var(--color-ink)' }}>{partner.name}</span>
        )}
        {canEdit ? (
          <select value={partner.kind} onChange={(e) => onPatch({ kind: e.target.value })} className="text-[11px] rounded px-1.5 py-1" style={inputStyle}>
            {PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--color-ink-3)' }}>{kind.label}</span>
        )}
        {canEdit ? (
          <select
            value={partner.status}
            onChange={(e) => onPatch({ status: e.target.value })}
            className="text-[11px] font-semibold rounded px-1.5 py-1"
            style={{ background: `color-mix(in oklab, ${partnerStatusMeta(partner.status).color} 14%, var(--color-bg-2))`, border: `1px solid color-mix(in oklab, ${partnerStatusMeta(partner.status).color} 45%, transparent)`, color: partnerStatusMeta(partner.status).color }}
          >
            {PARTNER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        ) : (
          <span className="text-[11px] font-semibold" style={{ color: partnerStatusMeta(partner.status).color }}>{partnerStatusMeta(partner.status).label}</span>
        )}
        {canEdit && (
          <button type="button" onClick={onRemove} aria-label="Supprimer" className="p-1" style={{ color: 'var(--color-danger, #DC2626)' }}>
            <Trash2Icon size={13} />
          </button>
        )}
      </div>

      {/* Line 2: contributions · amount · responsible · relance */}
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <div className="flex items-center gap-1 flex-wrap">
          {PARTNER_CONTRIBUTIONS.map((c) => {
            const on = partner.contributions.includes(c.value)
            return (
              <button
                key={c.value}
                type="button"
                disabled={!canEdit}
                onClick={() => canEdit && toggleContribution(c.value)}
                className="px-1.5 py-0.5 rounded-full font-medium"
                style={{
                  background: on ? `color-mix(in oklab, ${c.color} 16%, transparent)` : 'var(--color-bg-2)',
                  border: `1px solid ${on ? c.color : 'var(--color-line)'}`,
                  color: on ? c.color : 'var(--color-ink-4)',
                  cursor: canEdit ? 'pointer' : 'default',
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>

        {hasArgent && (
          canEdit ? (
            <input
              type="number" min={0} step="1" value={amount} onChange={(e) => setAmount(e.target.value)}
              onBlur={() => { const v = amount.trim() === '' ? null : Math.max(0, Number(amount)); if (v !== partner.amount) onPatch({ amount: v }) }}
              placeholder="Montant €"
              className="w-24 rounded px-1.5 py-0.5 text-right"
              style={inputStyle}
            />
          ) : partner.amount != null ? (
            <span className="font-mono" style={{ color: 'var(--color-safe, #16A34A)' }}>{fmtMoney(partner.amount)}</span>
          ) : null
        )}

        {canEdit ? (
          <select
            value={partner.responsibleId ?? ''}
            onChange={(e) => onPatch({ responsibleId: e.target.value || null })}
            className="rounded px-1 py-0.5 max-w-[130px]"
            style={inputStyle}
            title="Responsable"
          >
            <option value="">— Qui gère ?</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        ) : responsibleName ? (
          <span style={{ color: 'var(--color-ink-3)' }}>👤 {responsibleName}</span>
        ) : null}

        {canEdit ? (
          <label className="flex items-center gap-1" style={{ color: overdue ? 'var(--color-warning)' : 'var(--color-ink-4)' }} title="Prochaine relance">
            <BellIcon size={11} />
            <input
              type="date"
              value={partner.nextContactDate ? partner.nextContactDate.slice(0, 10) : ''}
              onChange={(e) => onPatch({ nextContactDate: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : null })}
              className="rounded px-1 py-0.5 text-[11px]"
              style={inputStyle}
            />
          </label>
        ) : partner.nextContactDate ? (
          <span className="flex items-center gap-1" style={{ color: overdue ? 'var(--color-warning)' : 'var(--color-ink-4)' }}>
            <BellIcon size={11} /> relance {new Date(partner.nextContactDate).toLocaleDateString('fr-FR')}
          </span>
        ) : null}

        {overdue && <span className="font-semibold" style={{ color: 'var(--color-warning)' }}>à relancer</span>}

        {canEdit && canAddToBudget && (
          partner.budgetGainId ? (
            <span className="flex items-center gap-1" style={{ color: 'var(--color-safe, #16A34A)' }}>
              <WalletIcon size={11} /> Ajouté au budget
            </span>
          ) : (
            <button
              type="button"
              onClick={onAddToBudget}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: 'color-mix(in oklab, var(--color-lime) 16%, transparent)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)', color: 'var(--color-lime)' }}
              title="Créer une ligne de gain dans le budget"
            >
              <WalletIcon size={11} /> Ajouter au budget
            </button>
          )
        )}
      </div>

      {/* Details toggle */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1 text-[11px] self-start"
        style={{ color: 'var(--color-ink-4)' }}
      >
        {open ? <ChevronDownIcon size={12} /> : <ChevronRightIcon size={12} />}
        Détails & contact
      </button>

      {open && (
        <div className="grid sm:grid-cols-2 gap-2 pt-1">
          {canEdit ? (
            <>
              <Field label="Ce qu’on aimerait obtenir" value={wish} set={setWish} onCommit={() => { const v = wish.trim() || null; if (v !== (partner.wish ?? null)) onPatch({ wish: v }) }} full />
              <Field label="Contact" value={contactName} set={setContactName} onCommit={() => { const v = contactName.trim() || null; if (v !== (partner.contactName ?? null)) onPatch({ contactName: v }) }} />
              <Field label="Email" value={email} set={setEmail} onCommit={() => { const v = email.trim() || null; if (v !== (partner.email ?? null)) onPatch({ email: v }) }} />
              <Field label="Téléphone" value={phone} set={setPhone} onCommit={() => { const v = phone.trim() || null; if (v !== (partner.phone ?? null)) onPatch({ phone: v }) }} />
              <Field label="Note" value={note} set={setNote} onCommit={() => { const v = note.trim() || null; if (v !== (partner.note ?? null)) onPatch({ note: v }) }} full />
            </>
          ) : (
            <div className="text-[11px] flex flex-col gap-1" style={{ color: 'var(--color-ink-3)' }}>
              {partner.wish && <span>Objectif : {partner.wish}</span>}
              {partner.contactName && <span>Contact : {partner.contactName}</span>}
              {partner.email && <span>{partner.email}</span>}
              {partner.phone && <span>{partner.phone}</span>}
              {partner.note && <span>{partner.note}</span>}
            </div>
          )}

          {/* Journal des échanges */}
          <div className="sm:col-span-2 flex flex-col gap-1.5 pt-1 mt-1 border-t" style={{ borderColor: 'var(--color-line)' }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>Journal des échanges</span>
            {partner.interactions.length === 0 && (
              <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>Aucun échange noté.</span>
            )}
            {partner.interactions.map((it) => (
              <div key={it.id} className="flex items-start gap-2 text-[11px]">
                <span className="font-mono shrink-0" style={{ color: 'var(--color-ink-4)' }}>
                  {new Date(it.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
                <span className="flex-1" style={{ color: 'var(--color-ink-2)' }}>
                  {it.by && <b style={{ color: 'var(--color-ink-3)' }}>{it.by} · </b>}
                  {it.note}
                </span>
                {canEdit && (
                  <button type="button" onClick={() => onRemoveInteraction(it.id)} aria-label="Supprimer" style={{ color: 'var(--color-ink-4)' }}>
                    <Trash2Icon size={11} />
                  </button>
                )}
              </div>
            ))}
            {canEdit && (
              <form
                onSubmit={(e) => { e.preventDefault(); const n = itNote.trim(); if (!n) return; onAddInteraction(n, itBy.trim() || null); setItNote(''); setItBy('') }}
                className="flex flex-wrap gap-1.5 mt-0.5"
              >
                <input value={itBy} onChange={(e) => setItBy(e.target.value)} placeholder="Par (qui)" className="w-24 rounded px-2 py-1 text-[11px]" style={inputStyle} />
                <input value={itNote} onChange={(e) => setItNote(e.target.value)} placeholder="Échange, réponse…" className="flex-1 min-w-[140px] rounded px-2 py-1 text-[11px]" style={inputStyle} />
                <button type="submit" className="px-2.5 py-1 rounded text-[11px] font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
                  Noter
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function Field({
  label,
  value,
  set,
  onCommit,
  full,
}: {
  label: string
  value: string
  set: (v: string) => void
  onCommit: () => void
  full?: boolean
}) {
  return (
    <label className={`flex flex-col gap-0.5 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>{label}</span>
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        onBlur={onCommit}
        className="rounded px-2 py-1 text-xs"
        style={inputStyle}
      />
    </label>
  )
}

function AddPartnerForm({ onAdd }: { onAdd: (name: string, kind: string) => void }) {
  const [name, setName] = useState('')
  const [kind, setKind] = useState('SPONSOR')

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), kind)
    setName('')
  }

  const cell = 'px-2.5 py-1.5 rounded-md text-xs'
  const cellStyle: React.CSSProperties = { background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mb-2">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom du partenaire *" required className={`${cell} flex-1 min-w-[180px]`} style={cellStyle} />
      <select value={kind} onChange={(e) => setKind(e.target.value)} className={`${cell} w-44`} style={cellStyle}>
        {PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
      </select>
      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
        <PlusIcon size={13} /> Ajouter
      </button>
    </form>
  )
}
