"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { cn } from "@/lib/utils"

export function LoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Email ou mot de passe invalide.")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Une erreur s'est produite. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  async function handleDemoAccess() {
    setLoading(true)
    router.push("/dashboard")
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight mb-1"
          style={{ color: "var(--color-ink)" }}
        >
          Connexion
        </h1>
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Accédez à votre espace TrailSim
        </p>
      </div>

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

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="email"
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-ink-3)" }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="vous@exemple.com"
            className={cn(
              "h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors",
              "placeholder:text-[var(--color-ink-4)]"
            )}
            style={{
              backgroundColor: "var(--color-bg-2)",
              border: "1px solid var(--color-line)",
              color: "var(--color-ink)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--color-lime)"
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--color-line)"
            }}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="password"
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-ink-3)" }}
          >
            Mot de passe
          </label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            placeholder="••••••••"
            className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
            style={{
              backgroundColor: "var(--color-bg-2)",
              border: "1px solid var(--color-line)",
              color: "var(--color-ink)",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--color-lime)"
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--color-line)"
            }}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-10 w-full rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          style={{
            backgroundColor: "var(--color-lime)",
            color: "#0d1a00",
          }}
        >
          {loading ? "Connexion…" : "Se connecter"}
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-line)" }} />
        <span className="text-xs" style={{ color: "var(--color-ink-4)" }}>
          ou
        </span>
        <div className="flex-1 h-px" style={{ backgroundColor: "var(--color-line)" }} />
      </div>

      <button
        onClick={handleDemoAccess}
        disabled={loading}
        className="h-10 w-full rounded-lg text-sm transition-all duration-150 disabled:opacity-50"
        style={{
          backgroundColor: "transparent",
          border: "1px solid var(--color-line)",
          color: "var(--color-ink-3)",
        }}
        onMouseEnter={(e) => {
          ;(e.target as HTMLButtonElement).style.color = "var(--color-ink)"
        }}
        onMouseLeave={(e) => {
          ;(e.target as HTMLButtonElement).style.color = "var(--color-ink-3)"
        }}
      >
        Accès démo sans compte →
      </button>

      <p className="text-center text-sm" style={{ color: "var(--color-ink-3)" }}>
        Pas encore de compte?{" "}
        <Link
          href="/register"
          className="font-medium transition-colors"
          style={{ color: "var(--color-lime)" }}
        >
          Créer un compte →
        </Link>
      </p>
    </div>
  )
}
