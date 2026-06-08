'use client'

import { useRouter } from 'next/navigation'

interface SimOption {
  id: string
  label: string
}

interface ComparePickerProps {
  eventId: string
  sims: SimOption[]
  a?: string
  b?: string
}

/** Two dropdowns that drive the ?a=&b= comparison via the URL. */
export function ComparePicker({ eventId, sims, a, b }: ComparePickerProps) {
  const router = useRouter()

  function go(next: { a?: string; b?: string }) {
    const sp = new URLSearchParams()
    const na = next.a ?? a
    const nb = next.b ?? b
    if (na) sp.set('a', na)
    if (nb) sp.set('b', nb)
    router.push(`/events/${eventId}/results/compare?${sp.toString()}`)
  }

  const selectStyle = {
    background: 'var(--color-bg-2)',
    border: '1px solid var(--color-line)',
    color: 'var(--color-ink-2)',
  } as const

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <select
        value={a ?? ''}
        onChange={(e) => go({ a: e.target.value })}
        className="px-2.5 py-1.5 rounded-lg text-xs"
        style={selectStyle}
      >
        <option value="">Simulation A…</option>
        {sims.map((s) => (
          <option key={s.id} value={s.id} disabled={s.id === b}>
            {s.label}
          </option>
        ))}
      </select>
      <span className="text-xs" style={{ color: 'var(--color-ink-4)' }}>vs</span>
      <select
        value={b ?? ''}
        onChange={(e) => go({ b: e.target.value })}
        className="px-2.5 py-1.5 rounded-lg text-xs"
        style={selectStyle}
      >
        <option value="">Simulation B…</option>
        {sims.map((s) => (
          <option key={s.id} value={s.id} disabled={s.id === a}>
            {s.label}
          </option>
        ))}
      </select>
    </div>
  )
}
