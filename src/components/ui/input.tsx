'use client'

import { cn } from '@/lib/utils'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
}

export function Input({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputProps) {
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined)

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-[var(--color-ink-2)]"
        >
          {label}
        </label>
      )}
      <input
        id={inputId}
        className={cn(
          'h-9 w-full rounded-lg px-3 text-sm',
          'bg-[var(--color-bg-2)] border border-[var(--color-line)]',
          'text-[var(--color-ink)] placeholder:text-[var(--color-ink-4)]',
          'outline-none transition-all duration-150',
          'focus:border-[var(--color-lime)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--color-lime)_20%,transparent)]',
          'disabled:opacity-50 disabled:cursor-not-allowed',
          error && 'border-[var(--color-danger)] focus:border-[var(--color-danger)] focus:ring-[color-mix(in_srgb,var(--color-danger)_20%,transparent)]',
          className
        )}
        {...props}
      />
      {error && (
        <p className="text-xs text-[var(--color-danger)]">{error}</p>
      )}
      {hint && !error && (
        <p className="text-xs text-[var(--color-ink-3)]">{hint}</p>
      )}
    </div>
  )
}
