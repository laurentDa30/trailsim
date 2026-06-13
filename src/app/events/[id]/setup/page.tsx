import { notFound } from "next/navigation"
import db from "@/lib/db"
import { auth } from "@/lib/auth"
import { getEventAccess, canRead } from "@/lib/authz"
import { SetupWizard } from "./setup-wizard"

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function SetupPage({ params }: PageProps) {
  const { id } = await params

  const event = await db.event.findUnique({
    where: { id },
    include: {
      races: {
        include: { segments: true },
        orderBy: { startTime: "asc" },
      },
      simulations: {
        orderBy: { createdAt: "desc" },
        take: 1,
        include: { runnerProfiles: true },
      },
    },
  })

  if (!event) {
    notFound()
  }

  const session = await auth()
  if (!session?.user?.id || !canRead(await getEventAccess(session.user.id, id))) notFound()

  // Real volunteers on the roster (event-level). The config counts these as
  // "validés"; the organiser can add fictional ones ("à rechercher") on top.
  const benevolesReels = await db.eventMember.count({
    where: { eventId: id, role: "BENEVOLE" },
  })

  return (
    <SetupWizard
      event={event}
      races={event.races}
      simulation={event.simulations[0] ?? null}
      benevolesReels={benevolesReels}
    />
  )
}
