'use client'

import { useState } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ZapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Step1Courses } from './step1-courses'
import { Step2Peloton } from './step2-peloton'
import { Step3Conditions } from './step3-conditions'
import type { Race, Simulation } from '@prisma/client'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3

const STEPS = [
  { n: 1 as const, label: 'Courses & tracés' },
  { n: 2 as const, label: 'Peloton' },
  { n: 3 as const, label: 'Conditions' },
]

interface SetupWizardProps {
  event: { id: string; name: string }
  races: Race[]
  simulation: Simulation | null
}

export function SetupWizard({ event, races: initialRaces, simulation }: SetupWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [races, setRaces] = useState(initialRaces)

  function handleNext() {
    if (step < 3) setStep((s) => (s + 1) as Step)
  }

  function handlePrev() {
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  function handleLaunch() {
    router.push(`/events/${event.id}/simulate`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      {/* Header */}
      <header className="border-b border-[var(--color-line)] bg-[var(--color-bg-1)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center gap-4">
          <a href="/dashboard" className="text-[var(--color-ink-3)] text-sm hover:text-[var(--color-ink)] transition-colors">TrailSim</a>
          <span className="text-[var(--color-line)]">/</span>
          <a href="/dashboard" className="text-[var(--color-ink-2)] text-sm hover:text-[var(--color-ink)] transition-colors">{event.name}</a>
          <span className="text-[var(--color-line)]">/</span>
          <span className="text-[var(--color-ink)] text-sm font-medium">Configuration</span>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-[var(--color-line)] bg-[var(--color-bg-1)]">
        <div className="max-w-5xl mx-auto px-6 py-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => {
              const isDone = step > s.n
              const isActive = step === s.n
              return (
                <div key={s.n} className="flex items-center gap-2">
                  <button
                    onClick={() => isDone && setStep(s.n)}
                    className={cn(
                      'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all',
                      isActive && 'bg-[var(--color-lime)] text-[#0d1a00]',
                      isDone && 'bg-[color-mix(in_srgb,var(--color-lime)_20%,transparent)] text-[var(--color-lime)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-lime)_30%,transparent)]',
                      !isActive && !isDone && 'bg-[var(--color-bg-2)] text-[var(--color-ink-4)] cursor-default'
                    )}
                  >
                    {isDone ? (
                      <CheckIcon size={13} />
                    ) : (
                      <span className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center text-xs',
                        isActive ? 'bg-[#0d1a00] text-[var(--color-lime)]' : 'bg-[var(--color-bg-1)] text-[var(--color-ink-4)]'
                      )}>
                        {s.n}
                      </span>
                    )}
                    {s.label}
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className="w-6 h-px bg-[var(--color-line)]" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {step === 1 && (
            <Step1Courses
              eventId={event.id}
              races={races}
              onUpdate={setRaces}
            />
          )}
          {step === 2 && (
            <Step2Peloton
              eventId={event.id}
              races={races}
              simulation={simulation}
              onUpdate={() => {}}
            />
          )}
          {step === 3 && (
            <Step3Conditions
              eventId={event.id}
              races={races}
              simulation={simulation}
              onUpdate={() => {}}
            />
          )}
        </div>
      </main>

      {/* Bottom nav */}
      <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg-1)]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Button
            variant="secondary"
            onClick={handlePrev}
            disabled={step === 1}
            className="gap-1.5"
          >
            <ChevronLeftIcon size={16} />
            Précédent
          </Button>

          <span className="text-[var(--color-ink-4)] text-sm">
            Étape {step} sur 3
          </span>

          {step < 3 ? (
            <Button variant="primary" onClick={handleNext} className="gap-1.5">
              Suivant
              <ChevronRightIcon size={16} />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleLaunch} className="gap-2">
              <ZapIcon size={15} />
              Lancer la simulation
              <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
