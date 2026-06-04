'use client'

import { cn } from '@/lib/utils'

type BadgeVariant = 'done' | 'running' | 'pending' | 'error' | 'lime' | 'danger' | 'warning' | 'safe'

interface BadgeProps {
  variant?: BadgeVariant
  children: React.ReactNode
  className?: string
}

const variantConfig: Record<BadgeVariant, { wrapper: string; dot: string; animate?: boolean }> = {
  done: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-safe)_12%,transparent)] text-[var(--color-safe)]',
    dot: 'bg-[var(--color-safe)]',
  },
  running: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-lime)_12%,transparent)] text-[var(--color-lime)]',
    dot: 'bg-[var(--color-lime)]',
    animate: true,
  },
  pending: {
    wrapper: 'bg-transparent border border-[var(--color-line)] text-[var(--color-ink-4)]',
    dot: 'bg-[var(--color-ink-4)]',
  },
  error: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]',
    dot: 'bg-[var(--color-danger)]',
  },
  lime: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-lime)_12%,transparent)] text-[var(--color-lime)]',
    dot: 'bg-[var(--color-lime)]',
  },
  danger: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-danger)_12%,transparent)] text-[var(--color-danger)]',
    dot: 'bg-[var(--color-danger)]',
  },
  warning: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-warning)_12%,transparent)] text-[var(--color-warning)]',
    dot: 'bg-[var(--color-warning)]',
  },
  safe: {
    wrapper: 'bg-[color-mix(in_srgb,var(--color-safe)_12%,transparent)] text-[var(--color-safe)]',
    dot: 'bg-[var(--color-safe)]',
  },
}

export function Badge({ variant = 'pending', children, className }: BadgeProps) {
  const config = variantConfig[variant]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        config.wrapper,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full flex-shrink-0',
          config.dot,
          config.animate && 'animate-pulse'
        )}
      />
      {children}
    </span>
  )
}
