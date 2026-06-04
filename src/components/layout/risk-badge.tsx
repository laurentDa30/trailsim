import { cn } from '@/lib/utils'

interface RiskBadgeProps {
  score: number
  className?: string
}

function getRiskConfig(score: number): { dotColor: string; textColor: string; label: string } {
  if (score >= 80) {
    return {
      dotColor: 'bg-[var(--color-danger)]',
      textColor: 'text-[var(--color-danger)]',
      label: 'Critique',
    }
  }
  if (score >= 60) {
    return {
      dotColor: 'bg-[#f87171]',
      textColor: 'text-[#f87171]',
      label: 'Élevé',
    }
  }
  if (score >= 30) {
    return {
      dotColor: 'bg-[var(--color-warning)]',
      textColor: 'text-[var(--color-warning)]',
      label: 'Modéré',
    }
  }
  return {
    dotColor: 'bg-[var(--color-safe)]',
    textColor: 'text-[var(--color-safe)]',
    label: 'Faible',
  }
}

export function RiskBadge({ score, className }: RiskBadgeProps) {
  const { dotColor, textColor } = getRiskConfig(score)

  return (
    <span className={cn('inline-flex items-center gap-1.5', textColor, className)}>
      <span className={cn('w-2 h-2 rounded-full flex-shrink-0', dotColor)} />
      <span className="text-sm font-semibold font-[var(--font-mono)]">
        {score}
      </span>
    </span>
  )
}
