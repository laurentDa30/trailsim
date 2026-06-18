'use client'

import Link from 'next/link'
import { FileTextIcon, Share2Icon, MapPinIcon, CalendarIcon, LogOut, ShieldCheck } from 'lucide-react'
import { signOut, useSession } from 'next-auth/react'
import { useState, useRef, useEffect, useMemo } from 'react'
import { PageNav, MobileNav } from './page-nav'
import { ThemeToggle } from './theme-toggle'
import { isAdminEmail } from '@/lib/admin'

type StatusKey = 'config' | 'sim' | 'results'

interface TopbarProps {
  activePage: 'dashboard' | 'config' | 'simulate' | 'results' | 'equipe' | 'budget' | 'taches'
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
  userInitials,
}: TopbarProps) {
  const st = status ? STATUS[status] : null
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Derive avatar initials from the signed-in user (name → "JD", else email).
  const { data: sessionData } = useSession()
  const isAdmin = isAdminEmail(sessionData?.user?.email)
  const initials = useMemo(() => {
    if (userInitials) return userInitials
    const name = sessionData?.user?.name?.trim()
    if (name) {
      const parts = name.split(/\s+/).filter(Boolean)
      const ii = (parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '')
      if (ii) return ii.toUpperCase()
    }
    const email = sessionData?.user?.email
    if (email) return email.slice(0, 2).toUpperCase()
    return 'OR'
  }, [userInitials, sessionData])

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  return (
    <header
      className="sticky top-0 flex items-center gap-3 px-4 shrink-0"
      style={{
        height: 52,
        background: 'var(--color-bg-1)',
        borderBottom: '1px solid var(--color-line)',
        zIndex: 1100,
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

      {/* Mobile nav (hamburger) — replaces the centered PageNav below md */}
      <MobileNav activePage={activePage} eventId={eventId} />

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
        className="hidden sm:flex items-center justify-center transition-colors shrink-0"
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

      {/* Avatar + dropdown */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex items-center justify-center text-[11px] font-bold cursor-pointer"
          style={{
            width: 30,
            height: 30,
            borderRadius: '50%',
            background: 'color-mix(in oklab, var(--color-lime) 20%, var(--color-bg-2))',
            color: 'var(--color-lime)',
          }}
          aria-label="Compte"
          aria-expanded={menuOpen}
        >
          {initials}
        </button>

        {menuOpen && (
          <div
            className="absolute right-0 top-full mt-2 w-44 rounded-lg overflow-hidden z-50"
            style={{
              background: 'var(--color-bg-1)',
              border: '1px solid var(--color-line)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
            }}
          >
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setMenuOpen(false)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--color-ink-2)', borderBottom: '1px solid var(--color-line)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-2)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ShieldCheck size={14} style={{ color: 'var(--color-ink-4)' }} />
                Administration
              </Link>
            )}
            <button
              onClick={() => signOut({ callbackUrl: '/login' })}
              className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors"
              style={{ color: 'var(--color-ink-2)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-bg-2)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <LogOut size={14} style={{ color: 'var(--color-ink-4)' }} />
              Se déconnecter
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
