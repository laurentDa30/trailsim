"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import { useRouter } from "next/navigation"
import Link from "next/link"

export function RegisterForm() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const inputStyle = {
    backgroundColor: "var(--color-bg-2)",
    border: "1px solid var(--color-line)",
    color: "var(--color-ink)",
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--color-lime)"
  }

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    e.target.style.borderColor = "var(--color-line)"
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.")
      return
    }

    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }

    setLoading(true)

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Une erreur s'est produite.")
        return
      }

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError("Compte créé, mais connexion échouée. Veuillez vous connecter.")
        router.push("/login")
      } else {
        router.push("/dashboard")
        router.refresh()
      }
    } catch {
      setError("Une erreur réseau s'est produite. Veuillez réessayer.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col gap-6">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight mb-1"
          style={{ color: "var(--color-ink)" }}
        >
          Créer un compte
        </h1>
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Rejoignez TrailSim pour gérer vos événements
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
            htmlFor="name"
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-ink-3)" }}
          >
            Nom complet
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Jean Dupont"
            className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

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
            className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
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
            autoComplete="new-password"
            placeholder="8 caractères minimum"
            className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="confirmPassword"
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--color-ink-3)" }}
          >
            Confirmer le mot de passe
          </label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="h-10 px-3 rounded-lg text-sm w-full outline-none transition-colors"
            style={inputStyle}
            onFocus={handleFocus}
            onBlur={handleBlur}
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="h-10 w-full rounded-lg text-sm font-medium transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed mt-1"
          style={{
            backgroundColor: "var(--color-lime)",
            color: "#ffffff",
          }}
        >
          {loading ? "Création du compte…" : "Créer mon compte →"}
        </button>
      </form>

      <p className="text-center text-sm" style={{ color: "var(--color-ink-3)" }}>
        Déjà un compte?{" "}
        <Link
          href="/login"
          className="font-medium transition-colors"
          style={{ color: "var(--color-lime)" }}
        >
          Se connecter →
        </Link>
      </p>
    </div>
  )
}
