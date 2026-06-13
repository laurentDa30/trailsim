import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { Topbar } from "@/components/layout/topbar"
import { StatCard } from "@/components/layout/stat-card"
import { EventCard } from "@/components/dashboard/event-card"
import { Plus, LayoutDashboard } from "lucide-react"

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  // Owned events + events the user joined as an active member (équipe).
  const events = await db.event.findMany({
    where: {
      OR: [
        { userId: session.user.id },
        { members: { some: { userId: session.user.id, status: "ACTIF" } } },
      ],
    },
    include: {
      _count: { select: { simulations: true } },
      races: {
        select: {
          id: true,
          name: true,
          color: true,
        },
      },
      simulations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          status: true,
          totalRunners: true,
          resultSnapshot: true,
        },
      },
      tasks: {
        select: { done: true, dueDate: true },
      },
      members: {
        select: { role: true, status: true },
      },
    },
    orderBy: { createdAt: "desc" },
  })

  // Per-event reminders: task breakdown (dépassées / en attente / terminées)
  // and volunteer counts (validés = bénévoles ayant accepté l'invitation).
  const now = Date.now()
  const taskStatsMap = new Map<string, { overdue: number; pending: number; done: number }>()
  const volunteerMap = new Map<string, { validated: number; total: number }>()
  for (const e of events) {
    let overdue = 0
    let pending = 0
    let done = 0
    for (const t of e.tasks) {
      if (t.done) {
        done++
      } else if (t.dueDate && new Date(t.dueDate).getTime() < now) {
        overdue++
      } else {
        pending++
      }
    }
    taskStatsMap.set(e.id, { overdue, pending, done })

    let validated = 0
    let total = 0
    for (const m of e.members) {
      if (m.role !== "BENEVOLE") continue
      total++
      if (m.status === "ACTIF") validated++
    }
    volunteerMap.set(e.id, { validated, total })
  }

  // Compute stats
  const totalRaces = events.reduce((sum, e) => sum + e.races.length, 0)
  // Each event only loads its latest simulation, so use the real count
  const totalSimulations = events.reduce((sum, e) => sum + e._count.simulations, 0)

  // Get simulation total runners from latest simulations
  const totalSimulatedRunners = events.reduce((sum, e) => {
    const latest = e.simulations[0]
    return sum + (latest?.totalRunners ?? 0)
  }, 0)

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <Topbar activePage="dashboard" />

      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center w-9 h-9 rounded-xl"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-lime) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-lime) 20%, transparent)",
              }}
            >
              <LayoutDashboard size={16} style={{ color: "var(--color-lime)" }} />
            </div>
            <div>
              <h1
                className="text-lg font-semibold leading-tight"
                style={{ color: "var(--color-ink)" }}
              >
                Dashboard
              </h1>
              {session.user.name && (
                <p className="text-xs" style={{ color: "var(--color-ink-4)" }}>
                  Bonjour, {session.user.name}
                </p>
              )}
            </div>
          </div>

          <Link
            href="/events/new"
            className="inline-flex items-center gap-2 h-9 px-4 rounded-lg text-sm font-medium transition-all duration-150 hover:opacity-90"
            style={{
              backgroundColor: "var(--color-lime)",
              color: "#ffffff",
            }}
          >
            <Plus size={15} />
            Nouvel événement
          </Link>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard
            value={events.length}
            label="Événements"
            highlight={events.length > 0}
          />
          <StatCard
            value={totalRaces}
            label="Courses au total"
          />
          <StatCard
            value={totalSimulatedRunners.toLocaleString("fr-FR")}
            label="Coureurs simulés"
          />
          <StatCard
            value={totalSimulations}
            label="Simulations"
          />
        </div>

        {/* Events grid */}
        {events.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-24 px-6 rounded-2xl border"
            style={{
              backgroundColor: "var(--color-bg-1)",
              borderColor: "var(--color-line)",
            }}
          >
            <div
              className="flex items-center justify-center w-14 h-14 rounded-2xl mb-5"
              style={{
                backgroundColor: "color-mix(in srgb, var(--color-lime) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--color-lime) 15%, transparent)",
              }}
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 22 22"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline
                  points="2,16 6,10 9,13 13,5 17,9 20,7"
                  stroke="var(--color-lime)"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                />
                <line
                  x1="2"
                  y1="16"
                  x2="20"
                  y2="16"
                  stroke="var(--color-forest)"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <h2
              className="text-base font-semibold mb-2"
              style={{ color: "var(--color-ink)" }}
            >
              Aucun événement pour l&apos;instant
            </h2>
            <p
              className="text-sm text-center max-w-sm mb-6"
              style={{ color: "var(--color-ink-3)" }}
            >
              Créez votre premier événement pour commencer à simuler votre peloton et planifier votre logistique terrain.
            </p>
            <Link
              href="/events/new"
              className="inline-flex items-center gap-2 h-9 px-5 rounded-lg text-sm font-medium transition-all duration-150 hover:opacity-90"
              style={{
                backgroundColor: "var(--color-lime)",
                color: "#ffffff",
              }}
            >
              <Plus size={14} />
              Créer mon premier événement
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {events.map((event) => (
              <EventCard
                key={event.id}
                id={event.id}
                name={event.name}
                date={event.date}
                location={event.location}
                taskStats={taskStatsMap.get(event.id) ?? null}
                volunteers={volunteerMap.get(event.id) ?? null}
                races={event.races}
                totalRunners={event.simulations[0]?.totalRunners ?? 0}
                latestSimulation={
                  event.simulations[0]
                    ? {
                        id: event.simulations[0].id,
                        status: event.simulations[0].status as
                          | "PENDING"
                          | "RUNNING"
                          | "DONE"
                          | "ERROR",
                        totalRunners: event.simulations[0].totalRunners,
                        resultSnapshot: event.simulations[0].resultSnapshot,
                      }
                    : null
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
