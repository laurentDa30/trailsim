'use client'

import Link from 'next/link'
import { FileTextIcon, Share2Icon, MapPinIcon, CalendarIcon } from 'lucide-react'
import { PageNav } from './page-nav'
import { ThemeToggle } from './theme-toggle'

type StatusKey = 'config' | 'sim' | 'results'

interface TopbarProps {
  activePage: 'dashboard' | 'config' | 'simulate' | 'results' | 'equipe'
  eventId?: string
  eventName?: string
  eventDate?: string
  eventLocation?: string
  status?: StatusKey
  exportHref?: string
  userInitials?: string
}

const STATUS: Record<
  StatusKey,
  { label: string; color: string; tinted: boolean; pulse: boolean }
> = {
  config: { label: 'Configuration en cours', color: 'var(--color-ink-3)', tinted: false, pulse: false },
  sim: { label: 'Simulation en cours', color: 'var(--color-warning)', tinted: true, pulse: true },
  results: { label: 'Résultats disponibles', color: 'var(--color-safe)', tinted: true, pulse: true },
}

export function Topbar({
  activePage,
  eventId,
  eventName,
  eventDate,
  eventLocation,
  status,
  exportHref,
  userInitials = 'OR',
}: TopbarProps) {
  const st = status ? STATUS[status] : null

  return (
    <header
      className="flex items-center gap-3 px-4 shrink-0"
      style={{
        height: 52,
        background: 'var(--color-bg-1)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 shrink-0">
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
          <polyline
            points="1,16 6,8 10,13 14,5 18,9 21,6"
            stroke="var(--color-lime)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="text-sm font-semibold tracking-tight" style={{ color: 'var(--color-ink)' }}>
          Trail<b style={{ color: 'var(--color-lime)', fontWeight: 700 }}>Sim</b>
        </span>
      </Link>

      {/* Event info — name with address beside it */}
      {eventName && (
        <div
          className="flex items-baseline gap-2.5 min-w-0 pl-3.5 ml-1"
          style={{ borderLeft: '1px solid var(--color-line)' }}
        >
          <span className="text-[13px] font-semibold truncate shrink-0" style={{ color: 'var(--color-ink)' }}>
            {eventName}
          </span>
          {eventLocation && (
            <span
              className="hidden md:flex items-center gap-1 text-[11.5px] truncate min-w-0"
              style={{ color: 'var(--color-ink-3)' }}
            >
              <MapPinIcon size={11} style={{ color: 'var(--color-ink-4)' }} />
              <span className="truncate">{eventLocation}</span>
            </span>
          )}
          {eventDate && (
            <span
              className="hidden lg:flex items-center gap-1 text-[11.5px] shrink-0"
              style={{ color: 'var(--color-ink-4)' }}
            >
              <CalendarIcon size={11} />
              {eventDate}
            </span>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Centered page navigation */}
      <PageNav activePage={activePage} eventId={eventId} />

      <div className="flex-1" />

      {/* Status pill */}
      {st && (
        <span
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs shrink-0"
          style={{
            color: st.color,
            background: st.tinted
              ? `color-mix(in oklab, ${st.color} 14%, transparent)`
              : 'var(--color-bg-2)',
            border: `1px solid ${
              st.tinted ? `color-mix(in oklab, ${st.color} 30%, transparent)` : 'var(--color-line)'
            }`,
          }}
        >
          <span
            className={st.pulse ? 'ts-pulse-dot' : ''}
            style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor' }}
          />
          {st.label}
        </span>
      )}

      {/* Export PDF */}
      {exportHref && (
        <Link
          href={exportHref}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors shrink-0"
          style={{
            background: 'var(--color-bg-2)',
            border: '1px solid var(--color-line)',
            color: 'var(--color-ink-2)',
          }}
        >
          <FileTextIcon size={13} />
          <span className="hidden sm:inline">Export PDF</span>
        </Link>
      )}

      <ThemeToggle />

      {/* Share */}
      <button
        type="button"
        aria-label="Partager"
        className="flex items-center justify-center transition-colors shrink-0"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--color-bg-2)',
          border: '1px solid var(--color-line)',
          color: 'var(--color-ink-3)',
        }}
      >
        <Share2Icon size={15} />
      </button>

      {/* Avatar */}
      <div
        className="flex items-center justify-center shrink-0 text-[11px] font-bold"
        style={{
          width: 30,
          height: 30,
          borderRadius: '50%',
          background: 'color-mix(in oklab, var(--color-lime) 20%, var(--color-bg-2))',
          color: 'var(--color-lime)',
        }}
        aria-label="Compte"
      >
        {userInitials}
      </div>
    </header>
  )
}
