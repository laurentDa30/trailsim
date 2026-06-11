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
} from 'lucide-react'

interface Task {
  id: string
  title: string
  category: string
  dueDate: string | null
  done: boolean
  parentId: string | null
  note: string | null
}

interface TachesViewProps {
  event: { id: string; name: string; location: string | null; date: string | null }
  initialTasks: Task[]
  canEdit: boolean
}

const CATEGORIES = [
  { value: 'ADMINISTRATIF', label: 'Administratif', color: '#60A5FA' },
  { value: 'SECURITE', label: 'Sécurité', color: '#F87171' },
  { value: 'LOGISTIQUE', label: 'Logistique', color: '#FBBF24' },
  { value: 'COMMUNICATION', label: 'Communication', color: '#A78BFA' },
  { value: 'GENERAL', label: 'Général', color: '#9CA3AF' },
]

const inputStyle: React.CSSProperties = {
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-line)',
  color: 'var(--color-ink)',
}

function catOf(value: string) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1]
}

function fmtDate(iso: string) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }).format(
    new Date(iso)
  )
}

/** Days from today to the due date (negative = overdue). */
function daysUntil(iso: string): number {
  const due = new Date(iso)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86400_000)
}

export function TachesView({ event, initialTasks, canEdit }: TachesViewProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('GENERAL')
  const [due, setDue] = useState('')
  const [busy, setBusy] = useState(false)

  // Status groups hold top-level tasks only; sub-tasks render under their parent.
  const groups = useMemo(() => {
    const overdue: Task[] = []
    const upcoming: Task[] = []
    const noDate: Task[] = []
    const doneList: Task[] = []
    for (const t of tasks) {
      if (t.parentId) continue
      if (t.done) doneList.push(t)
      else if (!t.dueDate) noDate.push(t)
      else if (daysUntil(t.dueDate) < 0) overdue.push(t)
      else upcoming.push(t)
    }
    return { overdue, upcoming, noDate, doneList }
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

  // Inline edit state (one task at a time)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [eTitle, setETitle] = useState('')
  const [eCategory, setECategory] = useState('GENERAL')
  const [eDue, setEDue] = useState('')

  // Quick "add sub-task" state (one parent at a time)
  const [subFor, setSubFor] = useState<string | null>(null)
  const [subTitle, setSubTitle] = useState('')

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

  async function toggleDone(t: Task) {
    const done = !t.done
    setTasks((prev) => prev.map((x) => (x.id === t.id ? { ...x, done } : x)))
    await fetch(`/api/events/${event.id}/tasks/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ done }),
    }).catch(() => {})
  }

  async function removeTask(id: string) {
    if (!confirm('Supprimer cette tâche (et ses sous-tâches) ?')) return
    setTasks((prev) => prev.filter((t) => t.id !== id && t.parentId !== id))
    await fetch(`/api/events/${event.id}/tasks/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  function startEdit(t: Task) {
    setEditingId(t.id)
    setETitle(t.title)
    setECategory(t.category)
    setEDue(t.dueDate ? t.dueDate.slice(0, 10) : '')
  }

  async function saveEdit() {
    if (!editingId || !eTitle.trim()) return
    const dueIso = eDue ? new Date(`${eDue}T12:00:00`).toISOString() : null
    setTasks((prev) =>
      prev.map((t) =>
        t.id === editingId ? { ...t, title: eTitle.trim(), category: eCategory, dueDate: dueIso } : t
      )
    )
    const id = editingId
    setEditingId(null)
    await fetch(`/api/events/${event.id}/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: eTitle.trim(), category: eCategory, dueDate: dueIso }),
    }).catch(() => {})
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
    const cat = catOf(t.category)
    const d = t.dueDate ? daysUntil(t.dueDate) : null
    const late = !t.done && d != null && d < 0
    const soon = !t.done && d != null && d >= 0 && d <= 14
    const kids = childrenOf.get(t.id) ?? []

    if (editingId === t.id) {
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
            value={eTitle}
            onChange={(e) => setETitle(e.target.value)}
            autoFocus
            className="flex-1 min-w-[160px] px-2 py-1 rounded text-xs"
            style={inputStyle}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveEdit()
              if (e.key === 'Escape') setEditingId(null)
            }}
          />
          <select
            value={eCategory}
            onChange={(e) => setECategory(e.target.value)}
            className="px-1.5 py-1 rounded text-[11px]"
            style={inputStyle}
          >
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={eDue}
            onChange={(e) => setEDue(e.target.value)}
            className="px-1.5 py-1 rounded text-[11px]"
            style={inputStyle}
          />
          <button
            type="button"
            onClick={saveEdit}
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
            onClick={() => setEditingId(null)}
            className="px-2 py-1 rounded text-[11px]"
            style={{ color: 'var(--color-ink-4)' }}
          >
            Annuler
          </button>
        </div>
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
          opacity: t.done ? 0.55 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={t.done}
          disabled={!canEdit}
          onChange={() => toggleDone(t)}
          className="shrink-0 accent-[var(--color-lime)]"
          aria-label={t.done ? 'Marquer à faire' : 'Marquer faite'}
        />
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-medium truncate"
            style={{
              color: 'var(--color-ink)',
              textDecoration: t.done ? 'line-through' : 'none',
            }}
          >
            {t.title}
          </div>
          <div className="flex items-center gap-2 text-[10.5px]" style={{ color: 'var(--color-ink-4)' }}>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: cat.color }} />
              {cat.label}
            </span>
            {t.dueDate && (
              <span
                className="flex items-center gap-1"
                style={{
                  color: late
                    ? 'var(--color-danger, #DC2626)'
                    : soon
                      ? 'var(--color-warning)'
                      : 'var(--color-ink-4)',
                }}
              >
                <CalendarIcon size={10} />
                {fmtDate(t.dueDate)}
                {!t.done && d != null && (
                  <span>
                    {d < 0 ? `· en retard de ${-d} j` : d === 0 ? '· aujourd’hui' : `· J−${d}`}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5 shrink-0">
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

  function Group({ label, items, tone }: { label: string; items: Task[]; tone?: 'danger' }) {
    if (items.length === 0) return null
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: tone === 'danger' ? 'var(--color-danger, #DC2626)' : 'var(--color-ink-4)' }}
        >
          {tone === 'danger' && <AlertTriangleIcon size={11} />}
          {label} ({items.length})
        </div>
        {items.map((t) => (
          <Row key={t.id} t={t} />
        ))}
      </div>
    )
  }

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
              Tâches d’organisation
            </span>
            <span className="text-[11px]" style={{ color: 'var(--color-ink-4)' }}>
              {tasks.filter((t) => !t.done).length} à faire · {groups.doneList.length} faites
            </span>
            <div className="flex-1" />
            {canEdit && (
              <button
                type="button"
                onClick={loadTemplate}
                disabled={busy}
                title="Ajoute la checklist type d'un trail (déclaration préfecture, secours, balisage…), calée sur la date de l'événement"
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[11px] font-medium"
                style={{
                  background: 'var(--color-bg-2)',
                  border: '1px solid var(--color-line)',
                  color: 'var(--color-ink-2)',
                }}
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
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
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
            ) : (
              <>
                <Group label="En retard" items={groups.overdue} tone="danger" />
                <Group label="À venir" items={groups.upcoming} />
                <Group label="Sans échéance" items={groups.noDate} />
                <Group label="Terminées" items={groups.doneList} />
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
