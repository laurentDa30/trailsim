import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  className?: string
}

export function Card({ children, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-[var(--color-bg-1)] border border-[var(--color-line)] rounded-xl',
        'transition-all duration-150',
        'hover:border-[color-mix(in_srgb,var(--color-lime)_25%,transparent)] hover:shadow-lg hover:shadow-black/20',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}
