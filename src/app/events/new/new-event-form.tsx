"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function NewEventForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [date, setDate] = useState("")
  const [location, setLocation] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    backgroundColor: "var(--color-bg-2)",
    border: "1px solid var(--color-line)",
    color: "var(--color-ink)",
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = "var(--color-lime)"
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) {
    e.target.style.borderColor = "var(--color-line)"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError("Le nom de l'événement est requis.")
      return
    }

    setLoading(true)

    try {
      // Build the payload — only send date if filled in
      const payload: Record<string, string | undefined> = {
        name: name.trim(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      }

      if (date) {
        // The API expects an ISO datetime string (z.string().datetime({ offset: true }))
        // date input gives "YYYY-MM-DD", append T00:00:00Z
        payload.date = `${date}T00:00:00Z`
      }

      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Une erreur s'est produite.")
        return
      }

      router.push(`/events/${data.id}/setup`)
    } catch {
      setError("Une erreur réseau s'est produite. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      {error && (
        <div
          className="text-sm px-3 py-2 rounded-lg border"
          style={{
            color: "var(--color-danger)",
            backgroundColor: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            borderColor: "color-mix(in srgb, var(--color-danger) 25%, transparent)",
          }}
        >
          {error}
        </div>
      )}

      {/* Nom de l'événement */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="name"
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--color-ink-3)" }}
        >
          Nom de l&apos;événement <span style={{ color: "var(--color-danger)" }}>*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Trail des Aiguilles 2025"
          className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* Date */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="date"
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--color-ink-3)" }}
        >
          Date
        </label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
          style={{
            ...inputStyle,
            colorScheme: "dark",
          }}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* Lieu */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="location"
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--color-ink-3)" }}
        >
          Lieu
        </label>
        <input
          id="location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Chamonix, Haute-Savoie"
          className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="description"
          className="text-xs font-medium uppercase tracking-wider"
          style={{ color: "var(--color-ink-3)" }}
        >
          Description
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Notes sur l'événement, contexte…"
          className="px-3 py-2.5 rounded-lg text-sm w-full outline-none transition-colors resize-none"
          style={inputStyle}
          onFocus={handleFocus}
          onBlur={handleBlur}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center h-10 px-5 rounded-lg text-sm font-medium transition-all duration-150 flex-1"
          style={{
            backgroundColor: "var(--color-bg-2)",
            border: "1px solid var(--color-line)",
            color: "var(--color-ink-3)",
          }}
        >
          Annuler
        </Link>
        <button
          type="submit"
          disabled={loading}
          className="h-10 px-5 rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed flex-1"
          style={{
            backgroundColor: "var(--color-lime)",
            color: "#ffffff",
          }}
        >
          {loading ? "Création…" : "Créer et configurer →"}
        </button>
      </div>
    </form>
  )
}
