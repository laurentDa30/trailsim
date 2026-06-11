import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"

// Standard French trail-organisation checklist. Offsets are days BEFORE the
// event date; when the event has no date the tasks are created without one.
const TEMPLATE: { days: number; title: string; category: string }[] = [
  { days: 120, title: "Déclarer la manifestation en préfecture / mairie", category: "ADMINISTRATIF" },
  { days: 90, title: "Obtenir les autorisations de passage (propriétaires, ONF, communes)", category: "ADMINISTRATIF" },
  { days: 90, title: "Souscrire l'assurance responsabilité civile organisateur", category: "ADMINISTRATIF" },
  { days: 60, title: "Signer la convention dispositif de secours (DPS) avec une association agréée", category: "SECURITE" },
  { days: 60, title: "Demander l'arrêté de circulation à la mairie", category: "ADMINISTRATIF" },
  { days: 45, title: "Commander dossards, lots et ravitaillements", category: "LOGISTIQUE" },
  { days: 45, title: "Ouvrir les inscriptions et lancer la communication", category: "COMMUNICATION" },
  { days: 30, title: "Recruter et affecter les bénévoles aux postes", category: "LOGISTIQUE" },
  { days: 15, title: "Briefing sécurité : plan d'évacuation et numéros d'urgence", category: "SECURITE" },
  { days: 7, title: "Baliser le parcours et vérifier les points d'eau", category: "LOGISTIQUE" },
  { days: 2, title: "Vérifier le matériel : barrières, sono, chronométrage, signalétique", category: "LOGISTIQUE" },
]

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }

    const event = await db.event.findUnique({ where: { id }, select: { date: true } })
    if (!event) return Response.json({ error: "Event not found" }, { status: 404 })

    // Idempotent: skip items whose title already exists on this event.
    const existing = await db.task.findMany({ where: { eventId: id }, select: { title: true } })
    const have = new Set(existing.map((t) => t.title))
    const toCreate = TEMPLATE.filter((t) => !have.has(t.title))

    await db.task.createMany({
      data: toCreate.map((t) => ({
        eventId: id,
        title: t.title,
        category: t.category,
        dueDate: event.date
          ? new Date(new Date(event.date).getTime() - t.days * 86400_000)
          : null,
      })),
    })

    const tasks = await db.task.findMany({
      where: { eventId: id },
      orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    })
    return Response.json({ created: toCreate.length, tasks }, { status: 201 })
  } catch (error) {
    console.error("[POST tasks/template]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
