'use client'

import Link from 'next/link'
import { Settings } from 'lucide-react'
import { PageNav } from './page-nav'
import { cn } from '@/lib/utils'

interface TopbarProps {
  eventName?: string
  eventDate?: string
  eventLocation?: string
  activePage: 'dashboard' | 'config' | 'simulate' | 'results'
  eventId?: string
}

export function Topbar({
  eventName,
  eventDate,
  eventLocation,
  activePage,
  eventId,
}: TopbarProps) {
  return (
    <header
      className={cn(
        'fixed top-0 z-50 w-full h-[52px]',
        'bg-[var(--color-bg-1)] border-b border-[var(--color-line)]',
        'flex items-center px-4 gap-4'
      )}
    >
      {/* Brand */}
      <Link href="/dashboard" className="flex items-center gap-2 flex-shrink-0">
        {/* SVG altimetry icon */}
        <svg
          width="22"
          height="22"
          viewBox="0 0 22 22"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          <polyline
            points="1,16 6,8 10,13 14,5 18,9 21,6"
            stroke="var(--color-lime)"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        <span className="text-sm font-semibold text-[var(--color-ink)] tracking-tight">
          Trail<b className="text-[var(--color-lime)]">Sim</b>
        </span>
      </Link>

      {/* Event info */}
      {eventName && (
        <div className="flex flex-col justify-center min-w-0 flex-shrink">
          <span className="text-xs font-medium text-[var(--color-ink-2)] truncate leading-tight">
            {eventName}
          </span>
          {(eventDate || eventLocation) && (
            <span className="text-[10px] text-[var(--color-ink-4)] truncate leading-tight">
              {[eventDate, eventLocation].filter(Boolean).join(' · ')}
            </span>
          )}
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Page nav */}
      <PageNav activePage={activePage} eventId={eventId} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center',
            'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]',
            'hover:bg-[var(--color-bg-2)] transition-all duration-150'
          )}
          aria-label="Tweaks"
        >
          <Settings size={15} />
        </button>

        {/* User avatar */}
        <div
          className={cn(
            'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
            'bg-[var(--color-forest)] border border-[var(--color-lime)]/30',
            'text-[10px] font-semibold text-[var(--color-lime)]'
          )}
          aria-label="User menu"
        >
          OR
        </div>
      </div>
    </header>
  )
}
