import { redirect, notFound } from "next/navigation"
import Link from "next/link"
import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { isAdminEmail } from "@/lib/admin"
import { Topbar } from "@/components/layout/topbar"
import { StatCard } from "@/components/layout/stat-card"
import { ShieldCheck } from "lucide-react"

export const dynamic = "force-dynamic"

function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—"
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(d))
}

export default async function AdminPage() {
  const session = await auth()
  if (!session?.user?.id) redirect("/login")
  // Email comes from the signed JWT — trustworthy for gating.
  if (!isAdminEmail(session.user.email)) notFound()

  // Global counts (no resultSnapshot reads — keeps DB transfer tiny).
  const [
    userCount,
    eventCount,
    raceCount,
    simCount,
    memberCount,
    taskCount,
    runnerAgg,
  ] = await Promise.all([
    db.user.count(),
    db.event.count(),
    db.race.count(),
    db.simulation.count(),
    db.eventMember.count(),
    db.task.count(),
    db.simulation.aggregate({ _sum: { totalRunners: true } }),
  ])
  const totalRunners = runnerAgg._sum.totalRunners ?? 0

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      _count: { select: { events: true, memberships: true } },
    },
  })

  const events = await db.event.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      date: true,
      location: true,
      createdAt: true,
      user: { select: { email: true, name: true } },
      _count: { select: { races: true, simulations: true, members: true, tasks: true } },
      simulations: { select: { totalRunners: true } },
    },
  })

  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <Topbar activePage="dashboard" />

      <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl"
            style={{
              backgroundColor: "color-mix(in srgb, var(--color-lime) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--color-lime) 20%, transparent)",
            }}
          >
            <ShieldCheck size={16} style={{ color: "var(--color-lime)" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold leading-tight" style={{ color: "var(--color-ink)" }}>
              Administration
            </h1>
            <p className="text-xs" style={{ color: "var(--color-ink-4)" }}>
              Vue d&apos;ensemble de la plateforme
            </p>
          </div>
        </div>

        {/* Global stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 mb-10">
          <StatCard value={userCount} label="Utilisateurs" highlight={userCount > 0} />
          <StatCard value={eventCount} label="Événements" />
          <StatCard value={raceCount} label="Courses" />
          <StatCard value={simCount} label="Simulations" />
          <StatCard value={totalRunners.toLocaleString("fr-FR")} label="Coureurs simulés" />
          <StatCard value={memberCount} label="Effectifs (membres)" />
          <StatCard value={taskCount} label="Tâches" />
        </div>

        {/* Users */}
        <SectionTitle>Utilisateurs ({users.length})</SectionTitle>
        <TableWrap>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Email", "Nom", "Inscrit le", "Événements", "Participations"].map((h) => (
                  <Th key={h}>{h}</Th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                  <Td mono>{u.email}</Td>
                  <Td>{u.name ?? "—"}</Td>
                  <Td>{fmtDate(u.createdAt)}</Td>
                  <Td>{u._count.events}</Td>
                  <Td>{u._count.memberships}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>

        {/* Events */}
        <SectionTitle>Événements ({events.length})</SectionTitle>
        <TableWrap>
          <table className="w-full text-sm" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Événement", "Propriétaire", "Date", "Courses", "Simulations", "Coureurs", "Effectifs", "Tâches"].map(
                  (h) => (
                    <Th key={h}>{h}</Th>
                  )
                )}
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const coureurs = e.simulations.reduce((m, s) => Math.max(m, s.totalRunners), 0)
                return (
                  <tr key={e.id} style={{ borderTop: "1px solid var(--color-line)" }}>
                    <Td>
                      <Link
                        href={`/events/${e.id}/setup`}
                        className="hover:underline"
                        style={{ color: "var(--color-ink)", fontWeight: 500 }}
                      >
                        {e.name}
                      </Link>
                      {e.location ? (
                        <span style={{ color: "var(--color-ink-4)" }}> · {e.location}</span>
                      ) : null}
                    </Td>
                    <Td mono>{e.user?.email ?? "—"}</Td>
                    <Td>{fmtDate(e.date)}</Td>
                    <Td>{e._count.races}</Td>
                    <Td>{e._count.simulations}</Td>
                    <Td>{coureurs.toLocaleString("fr-FR")}</Td>
                    <Td>{e._count.members}</Td>
                    <Td>{e._count.tasks}</Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </TableWrap>
      </main>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-[11px] font-semibold uppercase tracking-wider mb-3 mt-2"
      style={{ color: "var(--color-ink-4)" }}
    >
      {children}
    </h2>
  )
}

function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl overflow-x-auto mb-10"
      style={{ border: "1px solid var(--color-line)", backgroundColor: "var(--color-bg-1)" }}
    >
      {children}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="text-left px-3 py-2 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap"
      style={{ color: "var(--color-ink-4)", background: "var(--color-bg-2)" }}
    >
      {children}
    </th>
  )
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td
      className={`px-3 py-2 whitespace-nowrap ${mono ? "font-mono text-xs" : ""}`}
      style={{ color: "var(--color-ink-2)" }}
    >
      {children}
    </td>
  )
}
