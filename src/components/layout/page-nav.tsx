'use client'

import Link from 'next/link'
import { LayoutDashboard, Settings, Play, BarChart2, Users } from 'lucide-react'
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

export function PageNav({ activePage, eventId }: PageNavProps) {
  const items: NavItem[] = [
    {
      key: 'dashboard',
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={14} />,
    },
    {
      key: 'config',
      label: 'Configuration',
      href: eventId ? `/events/${eventId}/setup` : '#',
      icon: <Settings size={14} />,
    },
    {
      key: 'simulate',
      label: 'Simulation',
      href: eventId ? `/events/${eventId}/simulate` : '#',
      icon: <Play size={14} />,
    },
    {
      key: 'results',
      label: 'Résultats',
      href: eventId ? `/events/${eventId}/results` : '#',
      icon: <BarChart2 size={14} />,
    },
    {
      key: 'equipe',
      label: 'Équipe',
      href: eventId ? `/events/${eventId}/equipe` : '#',
      icon: <Users size={14} />,
    },
  ]

  return (
    <nav className="flex items-center gap-0.5">
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
