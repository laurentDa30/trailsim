'use client'

import { useMemo, useState } from 'react'
import { Topbar } from '@/components/layout/topbar'
import {
  ClipboardListIcon,
  PlusIcon,
  Trash2Icon,
  AlertTriangleIcon,
  CalendarIcon,
  SparklesIcon,
  PencilIcon,
  ListPlusIcon,
  UserIcon,
  WalletIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ListIcon,
} from 'lucide-react'
import {
  TASK_CATEGORIES,
  TASK_STATUSES,
  categoryMeta,
  statusMeta,
} from '@/lib/tasks'

interface Task {
  id: string
  title: string
  category: string
  status: string
  dueDate: string | null
  done: boolean
  parentId: string | null
  note: string | null
  assigneeId: string | null
  amountEstimated: number | null
  amountActual: number | null
}

interface Member {
  id: string
  name: string
  role: string
}

interface TachesViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  initialTasks: Task[]
  members: Member[]
  canEdit: boolean
}

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink)',
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  )
}

function fmtMoney(n: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(n) + ' €'
}

/** Days from today to the due date (negative = overdue). */
function daysUntil(iso: string): number {
  const due = new Date(iso)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400_000)
}

// Pipeline display order.
const STATUS_ORDER = ['EN_COURS', 'EN_ATTENTE', 'IMPOSSIBLE', 'VALIDE'] as const

interface TaskEditValues {
  title: string
  category: string
  dueDate: string | null
  amountEstimated: number | null
  amountActual: number | null
}

/**
 * Inline task editor with its OWN local state, defined at module scope so it
 * stays mounted while typing — otherwise every keystroke re-rendered the whole
 * list and the title's autoFocus stole focus from the amount inputs.
 */
function TaskEditRow({
  task,
  depth,
  onSave,
  onCancel,
}: {
  task: { title: string; category: string; dueDate: string | null; amountEstimated: number | null; amountActual: number | null }
  depth: number
  onSave: (v: TaskEditValues) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(task.title)
  const [category, setCategory] = useState(task.category)
  const [dueLocal, setDueLocal] = useState(task.dueDate ? task.dueDate.slice(0, 10) : '')
  const [est, setEst] = useState(task.amountEstimated != null ? String(task.amountEstimated) : '')
  const [act, setAct] = useState(task.amountActual != null ? String(task.amountActual) : '')

  function submit() {
    onSave({
      title: title.trim(),
      category,
      dueDate: dueLocal ? new Date(`${dueLocal}T12:00:00`).toISOString() : null,
      amountEstimated: est.trim() === '' ? null : Math.max(0, Number(est)),
      amountActual: act.trim() === '' ? null : Math.max(0, Number(act)),
    })
  }

  return (
    <div
      className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2"
      style={{
        marginLeft: depth * 22,
        background: 'var(--color-bg-2)',
        border: '1px solid color-mix(in oklab, var(--color-lime) 40%, var(--color-line))',
      }}
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        autoFocus
        className="flex-1 min-w-[160px] px-2 py-1 rounded text-xs"
        style={inputStyle}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit()
          if (e.key === 'Escape') onCancel()
        }}
      />
      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="px-1.5 py-1 rounded text-[11px]"
        style={inputStyle}
      >
        {TASK_CATEGORIES.map((c) => (
          <option key={c.value} value={c.value}>{c.label}</option>
        ))}
      </select>
      <input
        type="date"
        value={dueLocal}
        onChange={(e) => setDueLocal(e.target.value)}
        className="px-1.5 py-1 rounded text-[11px]"
        style={inputStyle}
      />
      <input
        type="number"
        min={0}
        value={est}
        onChange={(e) => setEst(e.target.value)}
        placeholder="Estimé €"
        className="w-24 px-1.5 py-1 rounded text-[11px]"
        style={inputStyle}
      />
      <input
        type="number"
        min={0}
        value={act}
        onChange={(e) => setAct(e.target.value)}
        placeholder="Réel €"
        className="w-24 px-1.5 py-1 rounded text-[11px]"
        style={inputStyle}
      />
      <button
        type="button"
        onClick={submit}
        className="px-2.5 py-1 rounded text-[11px] font-medium"
        style={{
          background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)',
          color: 'var(--color-lime)',
          border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)',
        }}
      >
        OK
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="px-2 py-1 rounded text-[11px]"
        style={{ color: 'var(--color-ink-4)' }}
      >
        Annuler
      </button>
    </div>
  )
}

// ── Calendar date helpers ──
const DAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']
const MONTH_LABELS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
]

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Monday-based weekday index (0 = Monday … 6 = Sunday). */
function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7
}

export function TachesView({ event, initialTasks, members, canEdit }: TachesViewProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const [calMonth, setCalMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const memberName = useMemo(() => {
    const m = new Map<string, string>()
    for (const x of members) m.set(x.id, x.name)
    return m
  }, [members])

  // Pipeline groups by status (top-level tasks only; sub-tasks render nested).
  const groups = useMemo(() => {
    const by: Record<string, Task[]> = { EN_COURS: [], EN_ATTENTE: [], IMPOSSIBLE: [], VALIDE: [] }
    for (const t of tasks) {
      if (t.parentId) continue
      const key = by[t.status] ? t.status : 'EN_ATTENTE'
      by[key].push(t)
    }
    return by
  }, [tasks])

  const childrenOf = useMemo(() => {
    const map = new Map<string, Task[]>()
    for (const t of tasks) {
      if (!t.parentId) continue
      if (!map.has(t.parentId)) map.set(t.parentId, [])
      map.get(t.parentId)!.push(t)
    }
    return map
  }, [tasks])

  // Budget rollup (all tasks, incl. sub-tasks).
  const budget = useMemo(() => {
    let est = 0
    let act = 0
    let hasAny = false
    for (const t of tasks) {
      if (t.amountEstimated != null) {
        est += t.amountEstimated
        hasAny = true
      }
      if (t.amountActual != null) {
        act += t.amountActual
        hasAny = true
      }
    }
    return { est, act, hasAny }
  }, [tasks])

  // Inline edit: only the id is parent state; the form fields live in the
  // stable TaskEditRow component (local state) so typing doesn't re-render the
  // whole list and steal focus.
  const [editingId, setEditingId] = useState<string | null>(null)

  // Quick "add sub-task" state (one parent at a time)
  const [subFor, setSubFor] = useState<string | null>(null)
  const [subTitle, setSubTitle] = useState('')

  function patch(id: string, body: Record<string, unknown>) {
    return fetch(`/api/events/${event.id}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {})
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          category,
          dueDate: due ? new Date(`${due}T12:00:00`).toISOString() : null,
        }),
      })
      if (res.ok) {
        const t = (await res.json()) as Task
        setTasks((prev) => [...prev, t])
        setTitle('')
        setDue('')
      }
    } finally {
      setBusy(false)
    }
  }

  async function loadTemplate() {
    if (busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/tasks/template`, { method: 'POST' })
      if (res.ok) {
        const data = (await res.json()) as { tasks: Task[] }
        setTasks(data.tasks)
      }
    } finally {
      setBusy(false)
    }
  }

  function setStatus(t: Task, status: string) {
    const done = status === 'VALIDE'
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, status, done } : x)))
    patch(t.id, { status })
  }

  function setAssignee(t: Task, assigneeId: string | null) {
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, assigneeId } : x)))
    patch(t.id, { assigneeId })
  }

  async function removeTask(id: string) {
    if (!confirm('Supprimer cette tâche (et ses sous-tâches) ?')) return
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id))
    await fetch(`/api/events/${event.id}/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function startEdit(t: Task) {
    setEditingId(t.id)
  }

  async function saveEdit(id: string, v: TaskEditValues) {
    if (!v.title.trim()) return
    setTasks((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              title: v.title.trim(),
              category: v.category,
              dueDate: v.dueDate,
              amountEstimated: v.amountEstimated,
              amountActual: v.amountActual,
            }
          : t
      )
    )
    setEditingId(null)
    await patch(id, {
      title: v.title.trim(),
      category: v.category,
      dueDate: v.dueDate,
      amountEstimated: v.amountEstimated,
      amountActual: v.amountActual,
    })
  }

  async function addSubTask(parent: Task) {
    if (!subTitle.trim() || busy) return
    setBusy(true)
    try {
      const res = await fetch(`/api/events/${event.id}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: subTitle.trim(), category: parent.category, parentId: parent.id }),
      })
      if (res.ok) {
        const t = (await res.json()) as Task
        setTasks((prev) => [...prev, t])
        setSubTitle('')
        setSubFor(null)
      }
    } finally {
      setBusy(false)
    }
  }

  function Row({ t, depth = 0 }: { t: Task; depth?: number }) {
    const cat = categoryMeta(t.category)
    const st = statusMeta(t.status)
    const d = t.dueDate ? daysUntil(t.dueDate) : null
    const late = t.status !== 'VALIDE' && t.status !== 'IMPOSSIBLE' && d != null && d < 0
    const soon = t.status !== 'VALIDE' && d != null && d >= 0 && d <= 14
    const kids = childrenOf.get(t.id) ?? []
    const assignee = t.assigneeId ? memberName.get(t.assigneeId) : null

    if (editingId === t.id) {
      return (
        <TaskEditRow
          task={t}
          depth={depth}
          onSave={(v) => saveEdit(t.id, v)}
          onCancel={() => setEditingId(null)}
        />
      )
    }

    return (
      <>
      <div
        className="flex items-center gap-2.5 rounded-lg px-3 py-2"
        style={{
          marginLeft: depth * 22,
          background: 'var(--color-bg-2)',
          border: `1px solid ${late ? 'color-mix(in oklab, var(--color-danger, #DC2626) 40%, var(--color-line))' : 'var(--color-line)'}`,
          opacity: t.status === 'VALIDE' ? 0.6 : t.status === 'IMPOSSIBLE' ? 0.7 : 1,
        }}
      >
        {/* Status control */}
        {canEdit ? (
          <select
            value={t.status}
            onChange={(e) => setStatus(t, e.target.value)}
            className="shrink-0 text-[10.5px] font-semibold rounded px-1.5 py-1"
            style={{
              background: `color-mix(in oklab, ${st.color} 14%, var(--color-bg-2))`,
              border: `1px solid color-mix(in oklab, ${st.color} 45%, transparent)`,
              color: st.color,
            }}
            aria-label="Statut"
          >
            {TASK_STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        ) : (
          <span
            className="shrink-0 text-[10.5px] font-semibold rounded px-1.5 py-1"
            style={{
              background: `color-mix(in oklab, ${st.color} 14%, var(--color-bg-2))`,
              border: `1px solid color-mix(in oklab, ${st.color} 45%, transparent)`,
              color: st.color,
            }}
          >
            {st.label}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-medium truncate"
            style={{
              color: 'var(--color-ink)',
              textDecoration: t.status === 'VALIDE' ? 'line-through' : 'none',
            }}
          >
            {t.title}
          </div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px]" style={{ color: 'var(--color-ink-4)' }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
              {cat.label}
            </span>
            {t.dueDate && (
              <span
                className="flex items-center gap-1"
                style={{ color: late ? 'var(--color-danger, #DC2626)' : soon ? 'var(--color-warning)' : 'var(--color-ink-4)' }}
              >
                <CalendarIcon size={10} />
                {fmtDate(t.dueDate)}
                {t.status !== 'VALIDE' && d != null && (
                  <span>{d < 0 ? `· retard ${-d} j` : d === 0 ? '· aujourd’hui' : `· J−${d}`}</span>
                )}
              </span>
            )}
            {assignee && (
              <span className="flex items-center gap-1">
                <UserIcon size={10} />
                {assignee}
              </span>
            )}
            {(t.amountEstimated != null || t.amountActual != null) && (
              <span className="flex items-center gap-1">
                <WalletIcon size={10} />
                {t.amountEstimated != null && `est. ${fmtMoney(t.amountEstimated)}`}
                {t.amountEstimated != null && t.amountActual != null && ' · '}
                {t.amountActual != null && `réel ${fmtMoney(t.amountActual)}`}
              </span>
            )}
          </div>
        </div>

        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Assignee dropdown (organisers + bénévoles) */}
            <select
              value={t.assigneeId ?? ''}
              onChange={(e) => setAssignee(t, e.target.value || null)}
              className="text-[10.5px] rounded px-1 py-1 max-w-[110px]"
              style={inputStyle}
              aria-label="Responsable"
              title="Responsable"
            >
              <option value="">— Qui ?</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            {depth === 0 && (
              <button
                type="button"
                onClick={() => {
                  setSubFor((cur) => (cur === t.id ? null : t.id))
                  setSubTitle('')
                }}
                title="Ajouter une sous-tâche"
                aria-label="Ajouter une sous-tâche"
                className="p-1 rounded"
                style={{ color: 'var(--color-ink-4)' }}
              >
                <ListPlusIcon size={13} />
              </button>
            )}
            <button
              type="button"
              onClick={() => startEdit(t)}
              title="Modifier"
              aria-label="Modifier"
              className="p-1 rounded"
              style={{ color: 'var(--color-ink-4)' }}
            >
              <PencilIcon size={13} />
            </button>
            <button
              type="button"
              onClick={() => removeTask(t.id)}
              aria-label="Supprimer"
              className="p-1 rounded"
              style={{ color: 'var(--color-danger, #DC2626)' }}
            >
              <Trash2Icon size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Quick sub-task input */}
      {subFor === t.id && canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            addSubTask(t)
          }}
          className="flex gap-2"
          style={{ marginLeft: (depth + 1) * 22 }}
        >
          <input
            value={subTitle}
            onChange={(e) => setSubTitle(e.target.value)}
            autoFocus
            placeholder="Sous-tâche…"
            className="flex-1 px-2.5 py-1.5 rounded-md text-xs"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSubFor(null)
            }}
          />
          <button
            type="submit"
            disabled={busy}
            className="px-2.5 py-1 rounded-md text-[11px] font-medium"
            style={{
              background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)',
              color: 'var(--color-lime)',
              border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)',
            }}
          >
            Ajouter
          </button>
        </form>
      )}

      {/* Sub-tasks, indented under their parent */}
      {kids.map((k) => (
        <Row key={k.id} t={k} depth={depth + 1} />
      ))}
      </>
    )
  }

  function Group({ statusValue }: { statusValue: string }) {
    const items = groups[statusValue] ?? []
    if (items.length === 0) return null
    const meta = statusMeta(statusValue)
    const danger = statusValue === 'IMPOSSIBLE'
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: meta.color }}
        >
          {danger && <AlertTriangleIcon size={11} />}
          <span className="w-2 h-2 rounded-full" style={{ background: meta.color }} />
          {meta.label} ({items.length})
        </div>
        {items.map((t) => (
          <Row key={t.id} t={t} />
        ))}
      </div>
    )
  }

  function Calendar() {
    // Tasks (parent + sub) grouped by their due day; undated listed separately.
    const byDay = new Map<string, Task[]>()
    const undated: Task[] = []
    for (const t of tasks) {
      if (!t.dueDate) {
        if (t.status !== 'VALIDE') undated.push(t)
        continue
      }
      const k = dayKey(new Date(t.dueDate))
      if (!byDay.has(k)) byDay.set(k, [])
      byDay.get(k)!.push(t)
    }

    const start = new Date(calMonth)
    start.setDate(1 - mondayIndex(calMonth))
    const cells: Date[] = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(start)
      d.setDate(start.getDate() + i)
      cells.push(d)
    }
    const todayKey = dayKey(new Date())
    const monthIdx = calMonth.getMonth()

    const shift = (delta: number) =>
      setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + delta, 1))

    return (
      <div className="flex flex-col gap-3">
        {/* Month nav */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => shift(-1)}
            className="p-1.5 rounded-md"
            style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-3)' }}
            aria-label="Mois précédent"
          >
            <ChevronLeftIcon size={15} />
          </button>
          <span className="text-sm font-semibold capitalize" style={{ color: 'var(--color-ink)' }}>
            {MONTH_LABELS[monthIdx]} {calMonth.getFullYear()}
          </span>
          <button
            type="button"
            onClick={() => shift(1)}
            className="p-1.5 rounded-md"
            style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-3)' }}
            aria-label="Mois suivant"
          >
            <ChevronRightIcon size={15} />
          </button>
        </div>

        {/* Weekday header */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const k = dayKey(d)
            const inMonth = d.getMonth() === monthIdx
            const isToday = k === todayKey
            const dayTasks = byDay.get(k) ?? []
            return (
              <div
                key={i}
                className="rounded-md p-1 flex flex-col gap-0.5"
                style={{
                  minHeight: 62,
                  background: inMonth ? 'var(--color-bg-2)' : 'transparent',
                  border: `1px solid ${isToday ? 'var(--color-lime)' : 'var(--color-line)'}`,
                  opacity: inMonth ? 1 : 0.4,
                }}
              >
                <span
                  className="text-[10px] font-medium tabular-nums"
                  style={{ color: isToday ? 'var(--color-lime)' : 'var(--color-ink-4)' }}
                >
                  {d.getDate()}
                </span>
                {dayTasks.slice(0, 3).map((t) => {
                  const meta = statusMeta(t.status)
                  const who = t.assigneeId ? memberName.get(t.assigneeId) : null
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => {
                        setView('list')
                        if (canEdit) startEdit(t)
                      }}
                      title={`${t.title}${who ? ` — ${who}` : ''} (${meta.label})`}
                      className="text-left truncate rounded px-1 py-0.5 text-[9.5px] leading-tight"
                      style={{
                        background: `color-mix(in oklab, ${meta.color} 18%, transparent)`,
                        color: 'var(--color-ink-2)',
                        borderLeft: `2px solid ${meta.color}`,
                        textDecoration: t.status === 'VALIDE' ? 'line-through' : 'none',
                      }}
                    >
                      {t.title}
                    </button>
                  )
                })}
                {dayTasks.length > 3 && (
                  <span className="text-[9px]" style={{ color: 'var(--color-ink-4)' }}>
                    +{dayTasks.length - 3}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Undated open tasks (not on the calendar) */}
        {undated.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-ink-4)' }}>
              Sans échéance
            </span>
            {undated.map((t) => {
              const meta = statusMeta(t.status)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setView('list')
                    if (canEdit) startEdit(t)
                  }}
                  className="truncate max-w-[160px] rounded px-1.5 py-0.5 text-[10px]"
                  style={{
                    background: `color-mix(in oklab, ${meta.color} 14%, transparent)`,
                    color: 'var(--color-ink-2)',
                    borderLeft: `2px solid ${meta.color}`,
                  }}
                >
                  {t.title}
                </button>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  const openCount = tasks.filter((t) => t.status !== 'VALIDE' && t.status !== 'IMPOSSIBLE').length
  const doneCount = tasks.filter((t) => t.status === 'VALIDE').length

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg)' }}>
      <Topbar
        activePage="taches"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        eventDate={event.date ? fmtDate(event.date) : undefined}
      />

      <main className="flex-1 w-full max-w-3xl mx-auto p-4 flex flex-col gap-4">
        {/* Budget summary */}
        {budget.hasAny && (
          <section
            className="rounded-xl px-4 py-3 flex flex-wrap items-center gap-x-5 gap-y-1"
            style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              <WalletIcon size={14} style={{ color: 'var(--color-lime)' }} /> Budget
            </span>
            <span className="text-xs" style={{ color: 'var(--color-ink-3)' }}>
              Estimé <b style={{ color: 'var(--color-ink)' }}>{fmtMoney(budget.est)}</b>
            </span>
            <span className="text-xs" style={{ color: 'var(--color-ink-3)' }}>
              Réel <b style={{ color: 'var(--color-ink)' }}>{fmtMoney(budget.act)}</b>
            </span>
            {budget.act > 0 && (
              <span
                className="text-xs"
                style={{ color: budget.act > budget.est ? 'var(--color-danger, #DC2626)' : 'var(--color-safe, #22C55E)' }}
              >
                Écart {budget.act - budget.est >= 0 ? '+' : ''}{fmtMoney(budget.act - budget.est)}
              </span>
            )}
          </section>
        )}

        <section
          className="rounded-xl overflow-hidden"
          style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
        >
          <div
            className="flex items-center gap-2 px-4 py-3"
            style={{ borderBottom: '1px solid var(--color-line)' }}
          >
            <span style={{ color: 'var(--color-lime)' }}>
              <ClipboardListIcon size={15} />
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-ink)' }}>
              Pipeline d’organisation
            </span>
            <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
              {openCount} en cours/à faire · {doneCount} validées
            </span>
            <div className="flex-1" />
            {/* View toggle: pipeline list vs calendar */}
            <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--color-line)' }}>
              {([
                { v: 'list' as const, icon: <ListIcon size={12} />, label: 'Liste' },
                { v: 'calendar' as const, icon: <CalendarIcon size={12} />, label: 'Calendrier' },
              ]).map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setView(o.v)}
                  className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium"
                  style={{
                    background: view === o.v ? 'color-mix(in oklab, var(--color-lime) 16%, transparent)' : 'var(--color-bg-2)',
                    color: view === o.v ? 'var(--color-lime)' : 'var(--color-ink-3)',
                  }}
                >
                  {o.icon} {o.label}
                </button>
              ))}
            </div>
            {canEdit && (
              <button
                type="button"
                onClick={loadTemplate}
                disabled={busy}
                title="Ajoute la checklist type d'un trail (déclaration préfecture, secours, balisage…), calée sur la date de l'événement"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)' }}
              >
                <SparklesIcon size={12} /> Charger le modèle trail
              </button>
            )}
          </div>

          <div className="p-4 flex flex-col gap-4">
            {canEdit && (
              <form onSubmit={addTask} className="flex flex-wrap gap-2">
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Nouvelle tâche *"
                  required
                  className="flex-1 min-w-[180px] px-2.5 py-1.5 rounded-md text-xs"
                  style={inputStyle}
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="px-2 py-1.5 rounded-md text-xs"
                  style={inputStyle}
                >
                  {TASK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  value={due}
                  onChange={(e) => setDue(e.target.value)}
                  className="px-2 py-1.5 rounded-md text-xs"
                  style={inputStyle}
                />
                <button
                  type="submit"
                  disabled={busy}
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

            {tasks.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
                Aucune tâche. {canEdit ? 'Chargez le modèle trail pour démarrer avec la checklist type (préfecture, assurance, secours, balisage…), ou ajoutez vos propres tâches.' : ''}
              </p>
            ) : view === 'calendar' ? (
              <Calendar />
            ) : (
              <>
                {STATUS_ORDER.map((s) => (
                  <Group key={s} statusValue={s} />
                ))}
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
