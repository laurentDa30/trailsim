'use client'

import { useState, useRef, useEffect } from 'react'
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ZapIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Step1Courses, type Resources } from './step1-courses'
import {
  Step2Peloton,
  buildInitialConfigs,
  archetypesToPeloton,
  refreshArchetypeTuning,
  PELOTON_CALIB_VERSION,
  type PelotonConfigs,
} from './step2-peloton'
import { Step3Conditions, type WeatherData } from './step3-conditions'
import { Step4Constraints } from './step4-constraints'
import { Topbar } from '@/components/layout/topbar'
import type { PlacedLogi } from '@/lib/logistics'
import type { Race, Segment, Simulation, RunnerProfile } from '@prisma/client'
import { useRouter } from 'next/navigation'

type Step = 1 | 2 | 3 | 4

const STEPS = [
  { n: 1 as const, label: 'Courses & tracés' },
  { n: 2 as const, label: 'Peloton' },
  { n: 3 as const, label: 'Conditions' },
  { n: 4 as const, label: 'Points sensibles' },
]

type RaceWithSegments = Race & { segments: Segment[] }

type SimulationWithProfiles = Simulation & { runnerProfiles: RunnerProfile[] }

interface SetupWizardProps {
  event: { id: string; name: string; location?: string | null; startClock?: string | null }
  races: RaceWithSegments[]
  simulation: SimulationWithProfiles | null
  /** Real volunteers on the event roster (counted as "validés"). */
  benevolesReels: number
}

export function SetupWizard({ event, races: initialRaces, simulation, benevolesReels }: SetupWizardProps) {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [races, setRaces] = useState(initialRaces)
  const [startClock, setStartClock] = useState<string | null>(event.startClock ?? null)
  const [launching, setLaunching] = useState(false)
  const [launchError, setLaunchError] = useState<string | null>(null)

  const [resources, setResources] = useState<Resources>(() => {
    try {
      if (simulation?.ressources) {
        const parsed = JSON.parse(simulation.ressources) as {
          effectifTotal?: number
          benevolesFictifs?: number
          barrieres?: number
        }
        // Prefer the saved fictional count; fall back to (old effectifTotal −
        // current real count) for simulations saved before this split existed.
        const fictifs =
          parsed.benevolesFictifs ??
          Math.max(0, (parsed.effectifTotal ?? benevolesReels) - benevolesReels)
        return { fictifs, barrieres: parsed.barrieres ?? 20 }
      }
    } catch {
      /* fall through to defaults */
    }
    return { fictifs: 0, barrieres: 20 }
  })

  // Total deployable staff = real roster volunteers + fictional placeholders.
  const effectifTotal = benevolesReels + resources.fictifs

  const [jamThreshold, setJamThreshold] = useState<number>(simulation?.jamThreshold ?? 10)
  const [affluenceThreshold, setAffluenceThreshold] = useState<number>(simulation?.affluenceThreshold ?? 15)
  const [nRuns, setNRuns] = useState<number>(simulation?.nRuns ?? 100)

  const [logistics, setLogistics] = useState<PlacedLogi[]>(() => {
    try {
      if (simulation?.logistique) return JSON.parse(simulation.logistique) as PlacedLogi[]
    } catch {
      /* ignore */
    }
    return []
  })

  // Peloton config: survives step navigation, restored from a local draft if
  // present, else from the last simulation's runner profiles, else defaults.
  const pelotonStorageKey = `ts_peloton:${event.id}`
  const [pelotonConfigs, setPelotonConfigs] = useState<PelotonConfigs>(() => {
    // 1. Local draft (edits not yet launched). Drafts are wrapped with the
    // calibration version: an older/legacy draft is refreshed once to the
    // current archetype tuning (keeping the organiser's distribution).
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(pelotonStorageKey)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed && parsed.__v === PELOTON_CALIB_VERSION && parsed.configs) {
            return parsed.configs as PelotonConfigs
          }
          const legacy = (parsed?.configs ?? parsed) as PelotonConfigs
          return refreshArchetypeTuning(legacy)
        }
      } catch {
        /* ignore */
      }
    }
    // 2. Per-race config saved with the last simulation → refresh tuning so the
    // current calibration applies automatically (distribution preserved).
    try {
      if (simulation?.peloton) {
        return refreshArchetypeTuning(JSON.parse(simulation.peloton) as PelotonConfigs)
      }
    } catch {
      /* ignore */
    }
    // 3. Rebuilt from the last simulation's profiles, else defaults
    return buildInitialConfigs(initialRaces, simulation?.runnerProfiles)
  })

  useEffect(() => {
    try {
      localStorage.setItem(
        pelotonStorageKey,
        JSON.stringify({ __v: PELOTON_CALIB_VERSION, configs: pelotonConfigs })
      )
    } catch {
      /* quota */
    }
  }, [pelotonConfigs, pelotonStorageKey])

  const weatherRef = useRef<WeatherData>({
    temperature: simulation?.temperature ?? 18,
    wind: simulation?.wind ?? 0,
    windDirection: simulation?.windDirection ?? 180,
    rain: simulation?.rain ?? false,
    rainIntensity: simulation?.rainIntensity ?? 40,
    fog: simulation?.fog ?? false,
  })

  function handleNext() {
    if (step < 4) setStep((s) => (s + 1) as Step)
  }

  function handlePrev() {
    if (step > 1) setStep((s) => (s - 1) as Step)
  }

  async function handleLaunch() {
    setLaunchError(null)

    const racesWithGpx = races.filter((r) => r.gpxPoints && r.gpxPoints !== '[]')
    if (racesWithGpx.length === 0) {
      setLaunchError('Importez au moins un fichier GPX (étape 1) avant de lancer la simulation.')
      setStep(1)
      return
    }

    const peloton = archetypesToPeloton(pelotonConfigs)
    if (peloton.profiles.length === 0) {
      setLaunchError('Configurez le peloton (étape 2) avant de lancer la simulation.')
      setStep(2)
      return
    }

    const weather = weatherRef.current

    setLaunching(true)
    try {
      // Flush any pending race edits (name/color/startTime) so the simulation
      // page reads the current wave starts, not stale/debounced values.
      await Promise.all(
        races.map((r) =>
          fetch(`/api/events/${event.id}/races/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: r.name, color: r.color, startTime: r.startTime }),
          }).catch(() => {})
        )
      )

      const res = await fetch(`/api/events/${event.id}/simulations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Simulation ${new Date().toLocaleDateString('fr-FR')}`,
          eventId: event.id,
          totalRunners: peloton.totalRunners,
          temperature: weather.temperature,
          wind: weather.wind,
          windDirection: weather.windDirection,
          rain: weather.rain,
          rainIntensity: weather.rainIntensity,
          fog: weather.fog,
          jamThreshold,
          affluenceThreshold,
          nRuns,
          runnerProfiles: peloton.profiles,
          peloton: JSON.stringify(pelotonConfigs),
          logistique: JSON.stringify(logistics),
          ressources: JSON.stringify({
            effectifTotal,
            benevolesReels,
            benevolesFictifs: resources.fictifs,
            barrieres: resources.barrieres,
          }),
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setLaunchError(data.error ?? 'Impossible de créer la simulation.')
        return
      }

      router.push(`/events/${event.id}/simulate`)
    } catch {
      setLaunchError('Erreur réseau. Veuillez réessayer.')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg)]">
      <Topbar
        activePage="config"
        eventId={event.id}
        eventName={event.name}
        eventLocation={event.location ?? undefined}
        status="config"
      />

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
                      isActive && 'bg-[var(--color-lime)] text-[#ffffff]',
                      isDone && 'bg-[color-mix(in_srgb,var(--color-lime)_20%,transparent)] text-[var(--color-lime)] cursor-pointer hover:bg-[color-mix(in_srgb,var(--color-lime)_30%,transparent)]',
                      !isActive && !isDone && 'bg-[var(--color-bg-2)] text-[var(--color-ink-4)] cursor-default'
                    )}
                  >
                    {isDone ? (
                      <CheckIcon size={13} />
                    ) : (
                      <span className={cn(
                        'w-4 h-4 rounded-full flex items-center justify-center text-xs',
                        isActive ? 'bg-[#ffffff] text-[var(--color-lime)]' : 'bg-[var(--color-bg-1)] text-[var(--color-ink-4)]'
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
              onUpdate={(rs) => setRaces(rs as RaceWithSegments[])}
              resources={resources}
              onResourcesChange={setResources}
              benevolesReels={benevolesReels}
              startClock={startClock}
              onStartClockChange={setStartClock}
            />
          )}
          {step === 2 && (
            <Step2Peloton
              races={races}
              configs={pelotonConfigs}
              setConfigs={setPelotonConfigs}
            />
          )}
          {step === 3 && (
            <Step3Conditions
              eventId={event.id}
              races={races}
              simulation={simulation}
              onUpdate={(w) => { weatherRef.current = w }}
            />
          )}
          {step === 4 && (
            <Step4Constraints
              eventId={event.id}
              races={races}
              jamThreshold={jamThreshold}
              onJamThresholdChange={setJamThreshold}
              affluenceThreshold={affluenceThreshold}
              onAffluenceThresholdChange={setAffluenceThreshold}
              nRuns={nRuns}
              onNRunsChange={setNRuns}
              logistics={logistics}
              onLogisticsChange={setLogistics}
              resources={{ effectif: effectifTotal, barrieres: resources.barrieres }}
            />
          )}
        </div>
      </main>

      {/* Bottom nav */}
      <footer className="border-t border-[var(--color-line)] bg-[var(--color-bg-1)]">
        {launchError && (
          <div className="max-w-5xl mx-auto px-6 pt-3">
            <p
              className="text-sm px-3 py-2 rounded-lg"
              style={{
                color: 'var(--color-danger)',
                backgroundColor: 'color-mix(in srgb, var(--color-danger) 10%, transparent)',
              }}
            >
              {launchError}
            </p>
          </div>
        )}
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
            Étape {step} sur 4
          </span>

          {step < 4 ? (
            <Button variant="primary" onClick={handleNext} className="gap-1.5">
              Suivant
              <ChevronRightIcon size={16} />
            </Button>
          ) : (
            <Button variant="primary" onClick={handleLaunch} disabled={launching} className="gap-2">
              <ZapIcon size={15} />
              {launching ? 'Création…' : 'Lancer la simulation'}
              <ChevronRightIcon size={16} />
            </Button>
          )}
        </div>
      </footer>
    </div>
  )
}
