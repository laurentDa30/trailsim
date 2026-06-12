'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { LayoutDashboard, Settings, Play, BarChart2, Users, ClipboardList, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  key: string
}

interface PageNavProps {
  activePage: string
  eventId?: string
}

function buildItems(eventId?: string): NavItem[] {
  return [
    { key: 'dashboard', label: 'Dashboard', href: '/dashboard', icon: <LayoutDashboard size={14} /> },
    { key: 'config', label: 'Configuration', href: eventId ? `/events/${eventId}/setup` : '#', icon: <Settings size={14} /> },
    { key: 'simulate', label: 'Simulation', href: eventId ? `/events/${eventId}/simulate` : '#', icon: <Play size={14} /> },
    { key: 'results', label: 'Résultats', href: eventId ? `/events/${eventId}/results` : '#', icon: <BarChart2 size={14} /> },
    { key: 'equipe', label: 'Équipe', href: eventId ? `/events/${eventId}/equipe` : '#', icon: <Users size={14} /> },
    { key: 'taches', label: 'Tâches', href: eventId ? `/events/${eventId}/taches` : '#', icon: <ClipboardList size={14} /> },
  ]
}

/** Desktop horizontal nav (hidden below md). */
export function PageNav({ activePage, eventId }: PageNavProps) {
  const items = buildItems(eventId)

  return (
    <nav className="hidden md:flex items-center gap-0.5">
      {items.map((item) => {
        const isActive = activePage === item.key
        const isDisabled = !eventId && item.key !== 'dashboard'

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-disabled={isDisabled}
            tabIndex={isDisabled ? -1 : undefined}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-150',
              isActive
                ? 'text-[var(--color-lime)] bg-[color-mix(in_srgb,var(--color-lime)_10%,transparent)]'
                : 'text-[var(--color-ink-3)] hover:text-[var(--color-ink)]',
              isDisabled && 'opacity-40 pointer-events-none'
            )}
          >
            {item.icon}
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}

/** Mobile hamburger + dropdown (hidden at md and up). */
export function MobileNav({ activePage, eventId }: PageNavProps) {
  const items = buildItems(eventId)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative md:hidden shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Menu"
        aria-expanded={open}
        className="flex items-center justify-center"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'var(--color-bg-2)',
          border: '1px solid var(--color-line)',
          color: 'var(--color-ink-2)',
        }}
      >
        <Menu size={16} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-52 rounded-lg overflow-hidden z-50 py-1"
          style={{
            background: 'var(--color-bg-1)',
            border: '1px solid var(--color-line)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
          }}
        >
          {items.map((item) => {
            const isActive = activePage === item.key
            const isDisabled = !eventId && item.key !== 'dashboard'
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                aria-disabled={isDisabled}
                tabIndex={isDisabled ? -1 : undefined}
                className={cn(
                  'flex items-center gap-2.5 px-3.5 py-2.5 text-sm transition-colors',
                  isActive ? 'text-[var(--color-lime)]' : 'text-[var(--color-ink-2)]',
                  isDisabled && 'opacity-40 pointer-events-none'
                )}
                style={
                  isActive
                    ? { background: 'color-mix(in srgb, var(--color-lime) 10%, transparent)' }
                    : undefined
                }
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
