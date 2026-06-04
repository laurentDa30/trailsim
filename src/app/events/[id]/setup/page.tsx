import { notFound } from "next/navigation"
import db from "@/lib/db"
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
      },
    },
  })

  if (!event) {
    notFound()
  }

  return (
    <SetupWizard
      event={event}
      races={event.races}
      simulation={event.simulations[0] ?? null}
    />
  )
}
