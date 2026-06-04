import { cn } from '@/lib/utils'

interface StatCardProps {
  value: string | number
  label: string
  icon?: React.ReactNode
  highlight?: boolean
  className?: string
}

export function StatCard({ value, label, icon, highlight = false, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-1)] border rounded-xl p-4',
        'flex flex-col gap-2',
        highlight
          ? 'border-[color-mix(in_srgb,var(--color-lime)_30%,transparent)]'
          : 'border-[var(--color-line)]',
        className
      )}
    >
      {icon && (
        <div className="text-[var(--color-ink-3)] w-4 h-4">
          {icon}
        </div>
      )}
      <div
        className={cn(
          'text-2xl font-semibold leading-none',
          'font-[var(--font-mono)]',
          highlight ? 'text-[var(--color-lime)]' : 'text-[var(--color-ink)]'
        )}
      >
        {value}
      </div>
      <div className="text-xs text-[var(--color-ink-3)] leading-none">
        {label}
      </div>
    </div>
  )
}
