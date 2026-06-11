"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Calendar, MapPin, Play, BarChart2, Users, ClipboardList, Trash2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

type SimulationStatus = "PENDING" | "RUNNING" | "DONE" | "ERROR"

interface Race {
  id: string
  name: string
  color: string
  _count?: { segments?: number }
  runnerCount?: number
}

interface Simulation {
  id: string
  status: SimulationStatus
  totalRunners: number
  resultSnapshot?: string | null
  // progress for RUNNING state (0–100)
  progress?: number
}

interface EventCardProps {
  id: string
  name: string
  date?: Date | string | null
  location?: string | null
  races: Race[]
  totalRunners: number
  latestSimulation?: Simulation | null
  status?: SimulationStatus
  /** Open-task reminders: overdue + due within 14 days (null = nothing due). */
  taskAlert?: { overdue: number; upcoming: number } | null
}

function StatusBadge({ status }: { status: SimulationStatus }) {
  const configs: Record<
    SimulationStatus,
    { label: string; bg: string; color: string; animated?: boolean }
  > = {
    DONE: {
      label: "Terminé",
      bg: "color-mix(in srgb, var(--color-safe) 12%, transparent)",
      color: "var(--color-safe)",
    },
    RUNNING: {
      label: "En cours",
      bg: "color-mix(in srgb, var(--color-lime) 12%, transparent)",
      color: "var(--color-lime)",
      animated: true,
    },
    PENDING: {
      label: "En attente",
      bg: "color-mix(in srgb, var(--color-ink-4) 15%, transparent)",
      color: "var(--color-ink-4)",
    },
    ERROR: {
      label: "Erreur",
      bg: "color-mix(in srgb, var(--color-danger) 12%, transparent)",
      color: "var(--color-danger)",
    },
  }

  const cfg = configs[status]

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ backgroundColor: cfg.bg, color: cfg.color }}
    >
      {cfg.animated && (
        <span className="relative flex h-1.5 w-1.5">
          <span
            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
            style={{ backgroundColor: cfg.color }}
          />
          <span
            className="relative inline-flex rounded-full h-1.5 w-1.5"
            style={{ backgroundColor: cfg.color }}
          />
        </span>
      )}
      {cfg.label}
    </span>
  )
}

function RiskBar({ score }: { score: number }) {
  const color =
    score > 80
      ? "var(--color-danger)"
      : score > 30
      ? "var(--color-warning)"
      : "var(--color-safe)"

  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: "var(--color-line)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
      <span
        className="text-xs font-mono tabular-nums"
        style={{ color, minWidth: "2.5rem", textAlign: "right" }}
      >
        {score}%
      </span>
    </div>
  )
}

function SimulationBlock({
  simulation,
}: {
  simulation?: Simulation | null
}) {
  if (!simulation) {
    return (
      <div className="text-xs" style={{ color: "var(--color-ink-4)" }}>
        Aucune simulation
      </div>
    )
  }

  if (simulation.status === "DONE") {
    // Max risk across detected zones (from the compressed result snapshot)
    let riskScore = 0
    let zones = 0
    if (simulation.resultSnapshot) {
      try {
        const snap = JSON.parse(simulation.resultSnapshot)
        const riskMap: { riskScore: number }[] = Array.isArray(snap.riskMap) ? snap.riskMap : []
        zones = riskMap.length
        riskScore = riskMap.reduce((m, e) => Math.max(m, e.riskScore ?? 0), 0)
        riskScore = Math.round(riskScore * 100)
      } catch {
        riskScore = 0
      }
    }

    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
            Risque max
          </span>
          <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
            {zones} zone{zones > 1 ? "s" : ""}
          </span>
        </div>
        <RiskBar score={riskScore} />
      </div>
    )
  }

  if (simulation.status === "RUNNING") {
    const progress = simulation.progress ?? 42
    return (
      <div className="flex flex-col gap-1.5">
        <div
          className="h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--color-line)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--color-lime)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
            }}
          />
        </div>
        <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
          {progress}/100 runs en cours…
        </span>
      </div>
    )
  }

  if (simulation.status === "ERROR") {
    return (
      <span className="text-xs" style={{ color: "var(--color-danger)" }}>
        Erreur — réessayer
      </span>
    )
  }

  // PENDING
  return (
    <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
      En attente de simulation
    </span>
  )
}

export function EventCard({
  id,
  name,
  date,
  location,
  races,
  totalRunners,
  latestSimulation,
  taskAlert,
}: EventCardProps) {
  const router = useRouter()
  const simStatus: SimulationStatus = latestSimulation?.status ?? "PENDING"

  async function handleDelete() {
    if (!confirm(`Supprimer l'événement « ${name} » et toutes ses simulations ? Cette action est irréversible.`)) return
    try {
      await fetch(`/api/events/${id}`, { method: "DELETE" })
      router.refresh()
    } catch {
      /* ignore */
    }
  }

  const formattedDate = date
    ? new Date(date).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null

  return (
    <div
      className={cn(
        "flex flex-col gap-4 p-4 rounded-xl border transition-all duration-150",
        "hover:border-[color-mix(in_srgb,var(--color-lime)_25%,transparent)]"
      )}
      style={{
        backgroundColor: "var(--color-bg-1)",
        borderColor: "var(--color-line)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <h3
          className="text-base font-semibold leading-tight flex-1 min-w-0 truncate"
          style={{ color: "var(--color-ink)" }}
        >
          {name}
        </h3>
        <StatusBadge status={simStatus} />
        <button
          onClick={handleDelete}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-bg-2)]"
          style={{ color: "var(--color-ink-4)" }}
          title="Supprimer l'événement"
          aria-label="Supprimer l'événement"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center gap-3">
        {formattedDate && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--color-ink-3)" }}
          >
            <Calendar size={12} style={{ color: "var(--color-ink-4)" }} />
            {formattedDate}
          </div>
        )}
        {location && (
          <div
            className="flex items-center gap-1.5 text-xs"
            style={{ color: "var(--color-ink-3)" }}
          >
            <MapPin size={12} style={{ color: "var(--color-ink-4)" }} />
            {location}
          </div>
        )}
      </div>

      {/* Races */}
      {races.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {races.map((race) => (
            <div
              key={race.id}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs"
              style={{
                backgroundColor: "var(--color-bg-2)",
                border: "1px solid var(--color-line)",
                color: "var(--color-ink-2)",
              }}
            >
              <span
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: race.color }}
              />
              {race.name}
              {race.runnerCount !== undefined && (
                <span
                  className="flex items-center gap-1"
                  style={{ color: "var(--color-ink-4)" }}
                >
                  <Users size={10} />
                  {race.runnerCount}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Task reminders */}
      {taskAlert && (
        <Link
          href={`/events/${id}/taches`}
          className="flex items-center gap-1.5 text-xs rounded-lg px-2.5 py-1.5"
          style={{
            color: taskAlert.overdue > 0 ? "var(--color-danger)" : "var(--color-warning)",
            backgroundColor:
              taskAlert.overdue > 0
                ? "color-mix(in srgb, var(--color-danger) 8%, transparent)"
                : "color-mix(in srgb, var(--color-warning) 10%, transparent)",
            border: `1px solid color-mix(in srgb, ${
              taskAlert.overdue > 0 ? "var(--color-danger)" : "var(--color-warning)"
            } 25%, transparent)`,
          }}
        >
          <AlertTriangle size={12} />
          {taskAlert.overdue > 0 && `${taskAlert.overdue} tâche${taskAlert.overdue > 1 ? "s" : ""} en retard`}
          {taskAlert.overdue > 0 && taskAlert.upcoming > 0 && " · "}
          {taskAlert.upcoming > 0 && `${taskAlert.upcoming} sous 14 j`}
        </Link>
      )}

      {/* Runners total */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
          Coureurs total
        </span>
        <span
          className="text-sm font-mono font-medium tabular-nums"
          style={{ color: "var(--color-ink-2)" }}
        >
          {totalRunners.toLocaleString("fr-FR")}
        </span>
      </div>

      {/* Simulation block */}
      <div
        className="p-3 rounded-lg"
        style={{
          backgroundColor: "var(--color-bg-2)",
          border: "1px solid var(--color-line)",
        }}
      >
        <SimulationBlock simulation={latestSimulation} />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-0.5">
        {[
          { href: `/events/${id}/setup`,    icon: Play,          label: "Simuler",   highlight: false },
          { href: `/events/${id}/equipe`,   icon: Users,         label: "Équipe",    highlight: false },
          { href: `/events/${id}/taches`,   icon: ClipboardList, label: "Tâches",    highlight: false },
          { href: `/events/${id}/results`,  icon: BarChart2,     label: "Résultats", highlight: true  },
        ].map(({ href, icon: Icon, label, highlight }) => (
          <Link
            key={href}
            href={href}
            className="group relative flex items-center justify-center flex-1 rounded-lg transition-all duration-150 hover:opacity-80"
            style={{
              height: 34,
              backgroundColor: highlight
                ? "color-mix(in srgb, var(--color-lime) 10%, transparent)"
                : "var(--color-bg-2)",
              border: `1px solid ${highlight
                ? "color-mix(in srgb, var(--color-lime) 20%, transparent)"
                : "var(--color-line)"}`,
              color: highlight ? "var(--color-lime)" : "var(--color-ink-3)",
            }}
            aria-label={label}
          >
            <Icon size={15} />
            <span
              className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-50"
              style={{
                backgroundColor: "var(--color-bg-1)",
                border: "1px solid var(--color-line)",
                color: "var(--color-ink-2)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.18)",
              }}
            >
              {label}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
