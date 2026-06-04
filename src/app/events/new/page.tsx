import Link from "next/link"
import { redirect } from "next/navigation"
import { ChevronLeft } from "lucide-react"
import { auth } from "@/lib/auth"
import { NewEventForm } from "./new-event-form"

export default async function NewEventPage() {
  const session = await auth()

  if (!session?.user?.id) {
    redirect("/login")
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {/* Minimal topbar */}
      <header
        className="flex items-center gap-3 px-5 h-12 flex-shrink-0"
        style={{
          backgroundColor: "var(--color-bg-1)",
          borderBottom: "1px solid var(--color-line)",
        }}
      >
        <Link
          href="/dashboard"
          className="flex items-center justify-center w-7 h-7 rounded-md transition-colors"
          style={{ color: "var(--color-ink-3)" }}
          aria-label="Retour au dashboard"
        >
          <ChevronLeft size={16} />
        </Link>
        <div
          className="w-px h-4"
          style={{ backgroundColor: "var(--color-line)" }}
        />
        <span
          className="text-sm font-medium"
          style={{ color: "var(--color-ink-2)" }}
        >
          Nouvel événement
        </span>
      </header>

      {/* Form container */}
      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg">
          {/* Card */}
          <div
            className="rounded-2xl border p-8"
            style={{
              backgroundColor: "var(--color-bg-1)",
              borderColor: "var(--color-line)",
            }}
          >
            <div className="mb-7">
              <h1
                className="text-xl font-semibold mb-1"
                style={{ color: "var(--color-ink)" }}
              >
                Créer un événement
              </h1>
              <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
                Renseignez les informations de base. Vous pourrez configurer les
                courses et les simulations ensuite.
              </p>
            </div>

            <NewEventForm />
          </div>
        </div>
      </main>
    </div>
  )
}
