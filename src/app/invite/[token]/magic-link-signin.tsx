'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface Props {
  token: string
  eventName: string
  eventId: string
  memberName: string
  /** Login mode: account already set up. The email is the login identifier. */
  mode: 'setup' | 'login'
  /** Login identifier to use (login mode), or the recorded email to show (setup). */
  email: string | null
  /** True when the recorded email is a real one (not the generic org-… form). */
  emailIsReal: boolean
}

export function MagicLinkSignIn({ token, eventName, eventId, memberName, mode, email, emailIsReal }: Props) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dest = `/events/${eventId}/setup`

  async function signInWith(loginEmail: string, pw: string): Promise<boolean> {
    const res = await signIn('credentials', { email: loginEmail, password: pw, redirect: false })
    return !!res?.ok && !res.error
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (mode === 'login') {
      if (!email) return
      setBusy(true)
      const ok = await signInWith(email, password)
      if (ok) {
        window.location.href = dest
        return
      }
      setError('Mot de passe incorrect.')
      setBusy(false)
      return
    }

    // setup
    if (password.length < 8) {
      setError('Le mot de passe doit faire au moins 8 caractères.')
      return
    }
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    try {
      const res = await fetch('/api/invite/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      const data = (await res.json().catch(() => ({}))) as { status?: string; email?: string }
      if (!res.ok || !data.email) {
        setError("Ce lien n'est plus valide. Demandez-en un nouveau à l'organisateur.")
        setBusy(false)
        return
      }
      if (data.status === 'linked') {
        // Email already had an account — sign in with its own password.
        const ok = await signInWith(data.email, password)
        if (ok) {
          window.location.href = dest
          return
        }
        setError(
          'Un compte existe déjà avec cet email. Connectez-vous avec votre mot de passe habituel sur la page de connexion.'
        )
        setBusy(false)
        return
      }
      const ok = await signInWith(data.email, password)
      window.location.href = ok ? dest : '/login'
    } catch {
      setError('Erreur réseau. Réessayez.')
      setBusy(false)
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <form
        onSubmit={submit}
        className="max-w-md w-full rounded-xl p-6"
        style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
      >
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-ink-4)' }}>
          Accès organisateur
        </p>
        <h1 className="text-lg font-semibold leading-tight mb-1" style={{ color: 'var(--color-ink)' }}>
          {eventName}
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--color-ink-3)' }}>
          Bonjour <strong>{memberName}</strong> 👋 —{' '}
          {mode === 'login'
            ? 'entrez votre mot de passe pour accéder à la gestion.'
            : 'choisissez un mot de passe pour créer votre accès. Vous vous reconnecterez ensuite avec ce lien et votre mot de passe.'}
        </p>

        {mode === 'setup' && emailIsReal && email && (
          <p className="text-xs mb-3 rounded-md px-2.5 py-1.5" style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-3)' }}>
            Identifiant de connexion : <strong style={{ color: 'var(--color-ink-2)' }}>{email}</strong>
          </p>
        )}

        <label className="block text-xs mb-1" style={{ color: 'var(--color-ink-3)' }}>
          Mot de passe
        </label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className="w-full px-2.5 py-2 rounded-md text-sm mb-3"
          style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}
        />

        {mode === 'setup' && (
          <>
            <label className="block text-xs mb-1" style={{ color: 'var(--color-ink-3)' }}>
              Confirmer le mot de passe
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full px-2.5 py-2 rounded-md text-sm mb-3"
              style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink)' }}
            />
          </>
        )}

        <button
          type="submit"
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-lime)', color: '#1a1a10' }}
        >
          {busy ? '…' : mode === 'login' ? 'Se connecter' : 'Créer mon accès'}
        </button>

        {error && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-danger, #DC2626)' }}>
            {error}
          </p>
        )}
      </form>
    </main>
  )
}
