'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Topbar } from '@/components/layout/topbar'
import { TASK_CATEGORIES } from '@/lib/tasks'
import { WalletIcon, PlusIcon, Trash2Icon, ClipboardListIcon, Paperclip, Pencil } from 'lucide-react'

// Budget categories: the task categories (so budget & tasks line up) plus a few
// budget-specific ones. Existing custom categories on the event are merged in.
const BUDGET_CATEGORIES = [
  ...TASK_CATEGORIES.map((c) => c.label),
  'Solutions Web',
  'Récompenses & lots',
  'Salaires',
  'Partenariats',
]

interface BudgetItem {
  id: string
  type: 'DEPENSE' | 'GAIN'
  category: string
  label: string
  quantity: number | null
  unitPrice: number | null
  supplier: string | null
  estimated: number
  paid: number
  who: string | null
  documentUrl: string | null
  taskId: string | null
}

interface BudgetViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  initialItems: BudgetItem[]
  tasks: { id: string; title: string }[]
  members: { id: string; name: string }[]
  runnerCount: number
  canEdit: boolean
}

// Distinct palette for the cost-distribution chart. Task categories keep their
// own colour so budget & tasks stay visually consistent.
const CHART_PALETTE = ['#7CB518', '#60A5FA', '#F87171', '#FBBF24', '#A78BFA', '#34D399', '#F472B6', '#FB923C', '#22D3EE', '#A3A3A3']
function catColor(category: string): string {
  const t = TASK_CATEGORIES.find((c) => c.label === category)
  if (t) return t.color
  let h = 0
  for (let i = 0; i < category.length; i++) h = (h * 31 + category.charCodeAt(i)) >>> 0
  return CHART_PALETTE[h % CHART_PALETTE.length]
}

const inputStyle: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid transparent',
  color: 'var(--color-ink)',
  borderRadius: 4,
  padding: '3px 5px',
  width: '100%',
  fontSize: 12,
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' €'
}

function num(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return isFinite(n) ? Math.max(0, n) : 0
}

export function BudgetView({ event, initialItems, tasks, members, runnerCount, canEdit }: BudgetViewProps) {
  const [items, setItems] = useState<BudgetItem[]>(initialItems)
  const taskTitle = (id: string | null) => (id ? tasks.find((t) => t.id === id)?.title ?? null : null)

  const depenses = items.filter((i) => i.type === 'DEPENSE')
  const gains = items.filter((i) => i.type === 'GAIN')
  const categories: string[] = []
  for (const i of depenses) if (!categories.includes(i.category)) categories.push(i.category)

  const totalEst = depenses.reduce((s, i) => s + i.estimated, 0)
  const totalReal = depenses.reduce((s, i) => s + i.paid, 0)
  const totalGains = gains.reduce((s, i) => s + i.estimated, 0)
  const global = totalGains - totalEst

  // Cost distribution by category (estimation) for the doughnut + cost/runner.
  const byCat = new Map<string, number>()
  for (const i of depenses) {
    const k = i.category || 'Sans catégorie'
    byCat.set(k, (byCat.get(k) ?? 0) + i.estimated)
  }
  const chartSegments = [...byCat.entries()]
    .filter(([, v]) => v > 0)
    .map(([label, value]) => ({ label, value, color: catColor(label) }))
    .sort((a, b) => b.value - a.value)
  const costPerRunner = runnerCount > 0 ? totalEst / runnerCount : null

  // ── CRUD ──
  async function createItem(payload: Partial<BudgetItem> & { label: string; type: 'DEPENSE' | 'GAIN' }) {
    const res = await fetch(`/api/events/${event.id}/budget`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).catch(() => null)
    if (res && res.ok) {
      const item = (await res.json()) as BudgetItem
      setItems((prev) => [...prev, item])
      return item
    }
    return null
  }

  /** Add an expense, optionally creating a linked task first. */
  async function addExpense(
    payload: Omit<BudgetItem, 'id' | 'type' | 'taskId' | 'documentUrl' | 'unitPrice'>,
    createTask: boolean
  ) {
    let taskId: string | null = null
    if (createTask) {
      // Carry "Qui" over to the task's assignee when it matches a member.
      const who = payload.who?.trim().toLowerCase()
      const assignee = who ? members.find((m) => m.name.trim().toLowerCase() === who) : undefined
      const res = await fetch(`/api/events/${event.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: payload.label,
          category: 'GENERAL',
          assigneeId: assignee?.id ?? null,
          // Carry the budget amounts over to the task too.
          amountEstimated: payload.estimated || null,
          amountActual: payload.paid || null,
        }),
      }).catch(() => null)
      if (res && res.ok) taskId = ((await res.json()) as { id: string }).id
    }
    await createItem({ ...payload, type: 'DEPENSE', taskId })
  }

  function patchItem(id: string, body: Partial<BudgetItem>) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...body } : i)))
    fetch(`/api/events/${event.id}/budget/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
    fetch(`/api/events/${event.id}/budget/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Topbar
        activePage="budget"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        eventDate={event.date ? new Date(event.date).toLocaleDateString('fr-FR') : undefined}
      />

      <datalist id="budget-members">
        {members.map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>

      <main className="flex-1 px-4 sm:px-6 py-6 max-w-6xl mx-auto w-full">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: 'var(--color-lime)' }}><WalletIcon size={18} /></span>
          <h1 className="text-lg font-semibold" style={{ color: 'var(--color-ink)' }}>Budget</h1>
        </div>
        <p className="text-xs mb-6" style={{ color: 'var(--color-ink-4)' }}>
          Suivez les dépenses et les gains de l’événement. Le « reste à payer » se calcule tout seul.
        </p>

        {/* Top summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <Summary label="Dépenses estimées" value={fmtMoney(totalEst)} color="var(--color-danger, #DC2626)" />
          <Summary label="Coût réel" value={fmtMoney(totalReal)} color="var(--color-warning)" />
          <Summary label="Total gains" value={fmtMoney(totalGains)} color="var(--color-safe, #16A34A)" />
          <Summary
            label="Solde (gains − estimé)"
            value={fmtMoney(global)}
            color={global >= 0 ? 'var(--color-safe, #16A34A)' : 'var(--color-danger, #DC2626)'}
            strong
          />
        </div>

        {/* Cost distribution + cost per runner */}
        {chartSegments.length > 0 && (
          <div className="grid md:grid-cols-2 gap-3 mb-2">
            <div className="rounded-xl p-4" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-ink-4)' }}>
                Répartition des dépenses (estimation)
              </div>
              <div className="flex items-center gap-4">
                <BudgetDonut segments={chartSegments} total={totalEst} />
                <div className="flex-1 flex flex-col gap-1 min-w-0">
                  {chartSegments.map((s) => (
                    <div key={s.label} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: s.color }} />
                      <span className="truncate" style={{ color: 'var(--color-ink-2)' }}>{s.label}</span>
                      <span className="ml-auto font-mono tabular-nums" style={{ color: 'var(--color-ink-3)' }}>
                        {Math.round((s.value / totalEst) * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-xl p-4 flex flex-col justify-center" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
              <div className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-ink-4)' }}>
                Coût par inscription coureur
              </div>
              {costPerRunner != null ? (
                <>
                  <div className="text-3xl font-bold font-mono" style={{ color: 'var(--color-ink)' }}>{fmtMoney(costPerRunner)}</div>
                  <p className="text-xs mt-1" style={{ color: 'var(--color-ink-4)' }}>
                    Dépenses estimées ({fmtMoney(totalEst)}) ÷ {runnerCount.toLocaleString('fr-FR')} coureurs.
                  </p>
                  {totalReal > 0 && (
                    <p className="text-xs mt-1" style={{ color: 'var(--color-ink-4)' }}>
                      Coût réel : <b style={{ color: 'var(--color-ink-2)' }}>{fmtMoney(totalReal / runnerCount)}</b> / coureur.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
                  Lancez une simulation pour estimer le nombre de coureurs et calculer le coût par inscription.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── DÉPENSES ── */}
        <SectionHeader>Dépenses</SectionHeader>
        <div className="rounded-xl overflow-x-auto mb-2" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 820 }}>
            <thead>
              <tr>
                <Th>Détail</Th>
                <Th right>Nombre</Th>
                <Th>Société</Th>
                <Th right>Estimation</Th>
                <Th right>Coût réel</Th>
                <Th>Qui</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-3 text-xs" style={{ color: 'var(--color-ink-4)' }}>
                    Aucune dépense. Ajoutez votre première ligne ci-dessous.
                  </td>
                </tr>
              )}
              {categories.map((cat) => {
                const rows = depenses.filter((i) => i.category === cat)
                const est = rows.reduce((s, i) => s + i.estimated, 0)
                const paid = rows.reduce((s, i) => s + i.paid, 0)
                return (
                  <CategoryBlock key={cat || '—'} cat={cat}>
                    {rows.map((i) => (
                      <ExpenseRow
                        key={i.id}
                        item={i}
                        canEdit={canEdit}
                        taskTitle={taskTitle(i.taskId)}
                        eventId={event.id}
                        onPatch={(b) => patchItem(i.id, b)}
                        onRemove={() => removeItem(i.id)}
                      />
                    ))}
                    <tr style={{ background: 'var(--color-bg-2)' }}>
                      <td className="px-3 py-1.5 text-[11px] font-semibold" style={{ color: 'var(--color-ink-3)' }}>
                        Sous-total
                      </td>
                      <td />
                      <td />
                      <Money>{est}</Money>
                      <Money>{paid}</Money>
                      <td />
                      <td />
                    </tr>
                  </CategoryBlock>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--color-line)' }}>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--color-ink)' }}>Total dépenses</td>
                <td />
                <td />
                <Money strong>{totalEst}</Money>
                <Money strong>{totalReal}</Money>
                <td />
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {canEdit && <AddExpenseForm categories={categories} onAdd={addExpense} />}

        {/* ── GAINS ── */}
        <SectionHeader>Gains</SectionHeader>
        <div className="rounded-xl overflow-x-auto mb-2" style={{ border: '1px solid var(--color-line)', background: 'var(--color-bg-1)' }}>
          <table className="w-full" style={{ borderCollapse: 'collapse', minWidth: 560 }}>
            <thead>
              <tr>
                <Th>Source</Th>
                <Th right>Quantité</Th>
                <Th right>Prix unitaire</Th>
                <Th right>Montant</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {gains.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-3 text-xs" style={{ color: 'var(--color-ink-4)' }}>
                    Aucun gain enregistré.
                  </td>
                </tr>
              )}
              {gains.map((i) => (
                <GainRow key={i.id} item={i} canEdit={canEdit} onPatch={(b) => patchItem(i.id, b)} onRemove={() => removeItem(i.id)} />
              ))}
              <tr style={{ borderTop: '2px solid var(--color-line)' }}>
                <td className="px-3 py-2 text-xs font-bold" style={{ color: 'var(--color-ink)' }}>Total gains</td>
                <td />
                <td />
                <Money strong>{totalGains}</Money>
                <td />
              </tr>
            </tbody>
          </table>
        </div>
        {canEdit && (
          <AddGainForm
            onAdd={(label, quantity, unitPrice, amount) =>
              createItem({ type: 'GAIN', label, quantity, unitPrice, estimated: amount })
            }
          />
        )}

        {/* ── SOLDE ── */}
        <div
          className="mt-6 rounded-xl px-4 py-3 flex items-center justify-between"
          style={{
            border: `1px solid ${global >= 0 ? 'color-mix(in oklab, var(--color-safe, #16A34A) 40%, var(--color-line))' : 'color-mix(in oklab, var(--color-danger, #DC2626) 40%, var(--color-line))'}`,
            background: 'var(--color-bg-1)',
          }}
        >
          <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>Solde global (gains − dépenses)</span>
          <span className="text-lg font-bold font-mono" style={{ color: global >= 0 ? 'var(--color-safe, #16A34A)' : 'var(--color-danger, #DC2626)' }}>
            {fmtMoney(global)}
          </span>
        </div>
      </main>
    </div>
  )
}

/* ── Layout sub-components ── */

function Summary({ label, value, color, strong }: { label: string; value: string; color: string; strong?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}>
      <div className="text-[11px] mb-1" style={{ color: 'var(--color-ink-4)' }}>{label}</div>
      <div className={`font-mono ${strong ? 'text-lg font-bold' : 'text-base font-semibold'}`} style={{ color }}>{value}</div>
    </div>
  )
}

function BudgetDonut({ segments, total }: { segments: { label: string; value: number; color: string }[]; total: number }) {
  const r = 54
  const sw = 22
  const C = 2 * Math.PI * r
  const centerLabel = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(total) + ' €'
  let offset = 0
  return (
    <svg width="132" height="132" viewBox="0 0 140 140" className="shrink-0">
      <circle cx={70} cy={70} r={r} fill="none" stroke="var(--color-bg-2)" strokeWidth={sw} />
      {segments.map((s) => {
        const len = total > 0 ? (s.value / total) * C : 0
        const el = (
          <circle
            key={s.label}
            cx={70}
            cy={70}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={sw}
            strokeDasharray={`${len} ${C - len}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 70 70)"
          />
        )
        offset += len
        return el
      })}
      <text x={70} y={66} textAnchor="middle" fontSize="10" fill="var(--color-ink-4)">Total</text>
      <text x={70} y={82} textAnchor="middle" fontSize="13" fontWeight="700" fill="var(--color-ink)">{centerLabel}</text>
    </svg>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider mb-2 mt-6" style={{ color: 'var(--color-ink-3)' }}>
      {children}
    </h2>
  )
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-3 py-2 text-[10px] font-semibold uppercase tracking-wider whitespace-nowrap ${right ? 'text-right' : 'text-left'}`}
      style={{ color: 'var(--color-ink-4)', background: 'var(--color-bg-2)' }}
    >
      {children}
    </th>
  )
}

function Money({ children, strong }: { children: number; strong?: boolean }) {
  return (
    <td className={`px-3 py-1.5 text-right font-mono whitespace-nowrap ${strong ? 'text-xs font-bold' : 'text-xs'}`} style={{ color: 'var(--color-ink-2)' }}>
      {fmtMoney(children)}
    </td>
  )
}

function CategoryBlock({ cat, children }: { cat: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={7} className="px-3 pt-2.5 pb-1 text-xs font-semibold" style={{ color: 'var(--color-lime)' }}>
          {cat || 'Sans catégorie'}
        </td>
      </tr>
      {children}
    </>
  )
}

/* ── Editable rows (module scope + local state → no focus loss on re-render) ── */

function ExpenseRow({
  item,
  canEdit,
  taskTitle,
  eventId,
  onPatch,
  onRemove,
}: {
  item: BudgetItem
  canEdit: boolean
  taskTitle: string | null
  eventId: string
  onPatch: (body: Partial<BudgetItem>) => void
  onRemove: () => void
}) {
  const [label, setLabel] = useState(item.label)
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : '')
  const [supplier, setSupplier] = useState(item.supplier ?? '')
  const [est, setEst] = useState(String(item.estimated))
  const [paid, setPaid] = useState(String(item.paid))
  const [who, setWho] = useState(item.who ?? '')

  if (!canEdit) {
    return (
      <tr style={{ borderTop: '1px solid var(--color-line)' }}>
        <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-ink)' }}>{item.label}</td>
        <td className="px-3 py-1.5 text-xs text-right" style={{ color: 'var(--color-ink-3)' }}>{item.quantity ?? ''}</td>
        <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-ink-3)' }}>{item.supplier ?? ''}</td>
        <Money>{item.estimated}</Money>
        <Money>{item.paid}</Money>
        <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-ink-3)' }}>{item.who ?? ''}</td>
        <td className="px-2 whitespace-nowrap">
          <div className="flex items-center gap-0.5">
            {item.documentUrl && (
              <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" title="Ouvrir le document" className="p-1" style={{ color: 'var(--color-lime)' }}>
                <Paperclip size={13} />
              </a>
            )}
            {taskTitle && <ClipboardListIcon size={13} style={{ color: 'var(--color-ink-4)' }} />}
          </div>
        </td>
      </tr>
    )
  }

  function editDoc() {
    const u = window.prompt('Lien du document (devis, facture, contrat… — laisser vide pour retirer)', item.documentUrl ?? '')
    if (u !== null) onPatch({ documentUrl: u.trim() || null })
  }

  return (
    <tr style={{ borderTop: '1px solid var(--color-line)' }}>
      <td className="px-1.5">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { const v = label.trim(); if (v && v !== item.label) onPatch({ label: v }); else if (!v) setLabel(item.label) }}
          style={inputStyle}
        />
      </td>
      <td className="px-1.5" style={{ width: 70 }}>
        <input
          type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)}
          onBlur={() => { const v = qty.trim() === '' ? null : Math.max(0, Math.round(Number(qty))); if (v !== item.quantity) onPatch({ quantity: v }) }}
          style={{ ...inputStyle, textAlign: 'right' }}
        />
      </td>
      <td className="px-1.5">
        <input
          value={supplier} onChange={(e) => setSupplier(e.target.value)}
          onBlur={() => { const v = supplier.trim() || null; if (v !== (item.supplier ?? null)) onPatch({ supplier: v }) }}
          style={inputStyle}
        />
      </td>
      <td className="px-1.5" style={{ width: 100 }}>
        <input
          type="number" min={0} step="0.01" value={est} onChange={(e) => setEst(e.target.value)}
          onBlur={() => { const v = num(est); if (v !== item.estimated) onPatch({ estimated: v }); setEst(String(v)) }}
          style={{ ...inputStyle, textAlign: 'right' }}
        />
      </td>
      <td className="px-1.5" style={{ width: 100 }}>
        <input
          type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)}
          onBlur={() => { const v = num(paid); if (v !== item.paid) onPatch({ paid: v }); setPaid(String(v)) }}
          style={{ ...inputStyle, textAlign: 'right' }}
        />
      </td>
      <td className="px-1.5" style={{ width: 110 }}>
        <input
          list="budget-members" value={who} onChange={(e) => setWho(e.target.value)}
          onBlur={() => { const v = who.trim() || null; if (v !== (item.who ?? null)) onPatch({ who: v }) }}
          style={inputStyle}
        />
      </td>
      <td className="px-1.5 whitespace-nowrap" style={{ width: 92 }}>
        <div className="flex items-center gap-0.5">
          {item.documentUrl && (
            <a href={item.documentUrl} target="_blank" rel="noopener noreferrer" title="Ouvrir le document" className="p-1" style={{ color: 'var(--color-lime)' }}>
              <Paperclip size={13} />
            </a>
          )}
          <button
            type="button"
            onClick={editDoc}
            title={item.documentUrl ? 'Modifier / retirer le lien du document' : 'Ajouter un lien (devis, facture…)'}
            aria-label="Lien document"
            className="p-1"
            style={{ color: item.documentUrl ? 'var(--color-ink-3)' : 'var(--color-ink-4)' }}
          >
            <Pencil size={12} />
          </button>
          {taskTitle && (
            <Link href={`/events/${eventId}/taches`} title={`Tâche liée : ${taskTitle}`} className="p-1">
              <ClipboardListIcon size={13} style={{ color: 'var(--color-lime)' }} />
            </Link>
          )}
          <button type="button" onClick={onRemove} aria-label="Supprimer" className="p-1" style={{ color: 'var(--color-danger, #DC2626)' }}>
            <Trash2Icon size={13} />
          </button>
        </div>
      </td>
    </tr>
  )
}

function GainRow({
  item,
  canEdit,
  onPatch,
  onRemove,
}: {
  item: BudgetItem
  canEdit: boolean
  onPatch: (body: Partial<BudgetItem>) => void
  onRemove: () => void
}) {
  const [label, setLabel] = useState(item.label)
  const [qty, setQty] = useState(item.quantity != null ? String(item.quantity) : '')
  const [unit, setUnit] = useState(item.unitPrice != null ? String(item.unitPrice) : '')
  const [amount, setAmount] = useState(String(item.estimated))

  // When both quantity and unit price are set, the amount is auto-computed.
  const qN = qty.trim() === '' ? null : Math.max(0, Math.round(Number(qty)))
  const uN = unit.trim() === '' ? null : num(unit)
  const auto = qN != null && uN != null
  const computed = auto ? qN * uN : null
  const shownAmount = auto ? fmtMoney(computed!) : null

  // Push quantity/unit changes, recomputing the stored amount when both are set.
  function commitQtyUnit(nextQty: number | null, nextUnit: number | null) {
    const body: Partial<BudgetItem> = { quantity: nextQty, unitPrice: nextUnit }
    if (nextQty != null && nextUnit != null) body.estimated = nextQty * nextUnit
    onPatch(body)
  }

  if (!canEdit) {
    return (
      <tr style={{ borderTop: '1px solid var(--color-line)' }}>
        <td className="px-3 py-1.5 text-xs" style={{ color: 'var(--color-ink)' }}>{item.label}</td>
        <td className="px-3 py-1.5 text-xs text-right" style={{ color: 'var(--color-ink-3)' }}>{item.quantity ?? ''}</td>
        <td className="px-3 py-1.5 text-xs text-right" style={{ color: 'var(--color-ink-3)' }}>{item.unitPrice != null ? fmtMoney(item.unitPrice) : ''}</td>
        <Money>{item.estimated}</Money>
        <td />
      </tr>
    )
  }

  return (
    <tr style={{ borderTop: '1px solid var(--color-line)' }}>
      <td className="px-1.5">
        <input
          value={label} onChange={(e) => setLabel(e.target.value)}
          onBlur={() => { const v = label.trim(); if (v && v !== item.label) onPatch({ label: v }); else if (!v) setLabel(item.label) }}
          style={inputStyle}
        />
      </td>
      <td className="px-1.5" style={{ width: 80 }}>
        <input
          type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)}
          onBlur={() => { const v = qty.trim() === '' ? null : Math.max(0, Math.round(Number(qty))); if (v !== item.quantity) commitQtyUnit(v, uN) }}
          placeholder="—"
          style={{ ...inputStyle, textAlign: 'right' }}
        />
      </td>
      <td className="px-1.5" style={{ width: 100 }}>
        <input
          type="number" min={0} step="0.01" value={unit} onChange={(e) => setUnit(e.target.value)}
          onBlur={() => { const v = unit.trim() === '' ? null : num(unit); if (v !== item.unitPrice) commitQtyUnit(qN, v) }}
          placeholder="—"
          style={{ ...inputStyle, textAlign: 'right' }}
        />
      </td>
      <td className="px-1.5" style={{ width: 110 }}>
        {auto ? (
          <div className="text-right font-mono text-xs py-1 pr-1" style={{ color: 'var(--color-ink-2)' }} title="Calculé : quantité × prix unitaire">
            {shownAmount}
          </div>
        ) : (
          <input
            type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)}
            onBlur={() => { const v = num(amount); if (v !== item.estimated) onPatch({ estimated: v }); setAmount(String(v)) }}
            style={{ ...inputStyle, textAlign: 'right' }}
          />
        )}
      </td>
      <td className="px-1.5" style={{ width: 44 }}>
        <button type="button" onClick={onRemove} aria-label="Supprimer" className="p-1" style={{ color: 'var(--color-danger, #DC2626)' }}>
          <Trash2Icon size={13} />
        </button>
      </td>
    </tr>
  )
}

/* ── Add forms ── */

function AddExpenseForm({
  categories,
  onAdd,
}: {
  categories: string[]
  onAdd: (payload: Omit<BudgetItem, 'id' | 'type' | 'taskId' | 'documentUrl' | 'unitPrice'>, createTask: boolean) => void
}) {
  const [cat, setCat] = useState('')
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')
  const [supplier, setSupplier] = useState('')
  const [est, setEst] = useState('')
  const [paid, setPaid] = useState('')
  const [who, setWho] = useState('')
  const [createTask, setCreateTask] = useState(false)

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    onAdd(
      {
        category: cat.trim(),
        label: label.trim(),
        quantity: qty.trim() === '' ? null : Math.max(0, Math.round(Number(qty))),
        supplier: supplier.trim() || null,
        estimated: num(est),
        paid: num(paid),
        who: who.trim() || null,
      },
      createTask
    )
    setCat(''); setLabel(''); setQty(''); setSupplier(''); setEst(''); setPaid(''); setWho('')
  }

  // Task categories + budget-specific ones + any custom category already used.
  const catOptions = Array.from(new Set([...BUDGET_CATEGORIES, ...categories.filter(Boolean)]))
  const cell = 'px-2 py-1.5 rounded-md text-xs'
  const cellStyle: React.CSSProperties = { background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mb-2">
      <select value={cat} onChange={(e) => setCat(e.target.value)} className={`${cell} w-40`} style={cellStyle}>
        <option value="">— Catégorie —</option>
        {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Détail *" required className={`${cell} flex-1 min-w-[140px]`} style={cellStyle} />
      <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Nb" className={`${cell} w-16`} style={cellStyle} />
      <input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Société" className={`${cell} w-32`} style={cellStyle} />
      <input type="number" min={0} step="0.01" value={est} onChange={(e) => setEst(e.target.value)} placeholder="Estim. €" className={`${cell} w-24`} style={cellStyle} />
      <input type="number" min={0} step="0.01" value={paid} onChange={(e) => setPaid(e.target.value)} placeholder="Payé €" className={`${cell} w-24`} style={cellStyle} />
      <input list="budget-members" value={who} onChange={(e) => setWho(e.target.value)} placeholder="Qui" className={`${cell} w-28`} style={cellStyle} />
      <label className="flex items-center gap-1 text-[11px]" style={{ color: 'var(--color-ink-3)' }} title="Crée aussi une tâche reliée à cette ligne">
        <input type="checkbox" checked={createTask} onChange={(e) => setCreateTask(e.target.checked)} />
        + tâche
      </label>
      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
        <PlusIcon size={13} /> Ajouter
      </button>
    </form>
  )
}

function AddGainForm({
  onAdd,
}: {
  onAdd: (label: string, quantity: number | null, unitPrice: number | null, amount: number) => void
}) {
  const [label, setLabel] = useState('')
  const [qty, setQty] = useState('')
  const [unit, setUnit] = useState('')
  const [amount, setAmount] = useState('')

  const qN = qty.trim() === '' ? null : Math.max(0, Math.round(Number(qty)))
  const uN = unit.trim() === '' ? null : num(unit)
  const auto = qN != null && uN != null
  const computed = auto ? qN * uN : null

  function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    // Quantity × unit price wins; otherwise the manual amount.
    onAdd(label.trim(), qN, uN, auto ? computed! : num(amount))
    setLabel(''); setQty(''); setUnit(''); setAmount('')
  }

  const cell = 'px-2 py-1.5 rounded-md text-xs'
  const cellStyle: React.CSSProperties = { background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-2 mb-2">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Source du gain * (sponsor, inscriptions…)" required className={`${cell} flex-1 min-w-[180px]`} style={cellStyle} />
      <input type="number" min={0} value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Quantité" className={`${cell} w-24`} style={cellStyle} title="Quantité (ex. nombre d'inscriptions)" />
      <input type="number" min={0} step="0.01" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="Prix unit. €" className={`${cell} w-28`} style={cellStyle} title="Prix unitaire" />
      <input
        type="number" min={0} step="0.01"
        value={auto ? String(computed) : amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={auto}
        placeholder="Montant €"
        className={`${cell} w-28`}
        style={{ ...cellStyle, opacity: auto ? 0.7 : 1 }}
        title={auto ? 'Calculé automatiquement (quantité × prix unitaire)' : 'Montant (si pas de quantité × prix)'}
      />
      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-medium" style={{ background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)', color: 'var(--color-lime)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)' }}>
        <PlusIcon size={13} /> Ajouter
      </button>
    </form>
  )
}
