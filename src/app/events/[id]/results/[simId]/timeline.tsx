'use client'

import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon } from 'lucide-react'

interface TimelineProps {
  timestamps: number[]
  timeIndex: number
  playing: boolean
  runnersOnCourse: number
  totalRunners: number
  speed: number
  onSpeedChange: (s: number) => void
  onScrub: (index: number) => void
  onTogglePlay: () => void
  onStepStart: () => void
  onStepEnd: () => void
}

const SPEEDS = [0.5, 1, 2, 4, 8]

function formatClock(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function formatElapsed(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  if (h > 0) return `T+${h}h${String(m).padStart(2, '0')}`
  return `T+${m}min`
}

export function Timeline({
  timestamps,
  timeIndex,
  playing,
  runnersOnCourse,
  totalRunners,
  speed,
  onSpeedChange,
  onScrub,
  onTogglePlay,
  onStepStart,
  onStepEnd,
}: TimelineProps) {
  const maxIndex = Math.max(0, timestamps.length - 1)
  const current = timestamps[timeIndex] ?? 0
  const disabled = timestamps.length === 0

  const btn =
    'flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-40'

  return (
    <div
      className="shrink-0 border-t flex items-center gap-4 px-5"
      style={{
        height: 56,
        background: 'var(--color-bg-1)',
        borderColor: 'var(--color-line)',
      }}
    >
      {/* Transport */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onStepStart}
          disabled={disabled}
          className={btn}
          style={{ color: 'var(--color-ink-3)' }}
          aria-label="Début"
        >
          <SkipBackIcon size={15} />
        </button>
        <button
          type="button"
          onClick={onTogglePlay}
          disabled={disabled}
          className={btn}
          style={{ background: 'var(--color-lime)', color: '#0d1a00', width: 36, height: 36 }}
          aria-label={playing ? 'Pause' : 'Lecture'}
        >
          {playing ? <PauseIcon size={16} /> : <PlayIcon size={16} />}
        </button>
        <button
          type="button"
          onClick={onStepEnd}
          disabled={disabled}
          className={btn}
          style={{ color: 'var(--color-ink-3)' }}
          aria-label="Fin"
        >
          <SkipForwardIcon size={15} />
        </button>
      </div>

      {/* Clock */}
      <div className="flex flex-col items-start shrink-0" style={{ width: 96 }}>
        <span
          className="font-mono text-sm font-semibold tabular-nums leading-none"
          style={{ color: 'var(--color-ink)' }}
        >
          {formatClock(current)}
        </span>
        <span className="text-[10px] font-mono" style={{ color: 'var(--color-ink-4)' }}>
          {formatElapsed(current)}
        </span>
      </div>

      {/* Scrubber with visible progress track */}
      <div className="relative flex-1 flex items-center" style={{ height: 18 }}>
        {/* Background track */}
        <div
          className="absolute left-0 right-0 h-1.5 rounded-full"
          style={{ background: 'var(--color-bg-2)' }}
        />
        {/* Filled progress */}
        <div
          className="absolute left-0 h-1.5 rounded-full"
          style={{
            width: `${maxIndex > 0 ? (timeIndex / maxIndex) * 100 : 0}%`,
            background: 'var(--color-lime)',
          }}
        />
        <input
          type="range"
          min={0}
          max={maxIndex}
          step={1}
          value={timeIndex}
          disabled={disabled}
          onChange={(e) => onScrub(parseInt(e.target.value))}
          className="absolute left-0 right-0 w-full appearance-none cursor-pointer bg-transparent"
          style={{ accentColor: 'var(--color-lime)' }}
        />
      </div>

      {/* Speed selector */}
      <div
        className="flex items-center gap-0.5 shrink-0 rounded-lg p-0.5"
        style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)' }}
      >
        {SPEEDS.map((s) => {
          const active = speed === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => onSpeedChange(s)}
              className="px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums transition-colors"
              style={{
                background: active ? 'var(--color-lime)' : 'transparent',
                color: active ? '#0d1a00' : 'var(--color-ink-3)',
                fontWeight: active ? 700 : 400,
              }}
            >
              {s}×
            </button>
          )
        })}
      </div>

      {/* Runners on course */}
      <div className="flex items-center gap-1.5 shrink-0">
        <span
          className="font-mono text-sm font-semibold tabular-nums"
          style={{ color: 'var(--color-lime)' }}
        >
          {runnersOnCourse}
        </span>
        <span className="text-[10px]" style={{ color: 'var(--color-ink-4)' }}>
          / {totalRunners} en piste
        </span>
      </div>
    </div>
  )
}

export default Timeline
