'use client'

import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  asChild?: boolean
  children?: React.ReactNode
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: [
    'bg-[var(--color-lime)] text-[#ffffff] font-medium',
    'hover:opacity-[0.88]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
  secondary: [
    'bg-[var(--color-bg-2)] border border-[var(--color-line)] text-[var(--color-ink-2)]',
    'hover:border-[color-mix(in_srgb,var(--color-lime)_30%,transparent)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
  ghost: [
    'text-[var(--color-ink-3)] bg-transparent',
    'hover:text-[var(--color-ink)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
  danger: [
    'bg-[color-mix(in_srgb,var(--color-danger)_10%,transparent)]',
    'text-[var(--color-danger)]',
    'border border-[color-mix(in_srgb,var(--color-danger)_30%,transparent)]',
    'hover:bg-[color-mix(in_srgb,var(--color-danger)_20%,transparent)]',
    'disabled:opacity-40 disabled:cursor-not-allowed',
  ].join(' '),
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'h-7 px-3 text-xs rounded-md gap-1.5',
  md: 'h-9 px-4 text-sm rounded-lg gap-2',
  lg: 'h-11 px-5 text-base rounded-xl gap-2.5',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  asChild = false,
  className,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return (
    <Comp
      className={cn(
        'inline-flex items-center justify-center font-[var(--font-ui)] transition-all duration-150 cursor-pointer select-none',
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  )
}
