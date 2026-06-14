'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'

interface Props {
  token: string
  eventName: string
  eventId: string
  memberName: string
}

/**
 * Passwordless bureau sign-in: the access token IS the credential. Clicking the
 * button signs the organiser in (creating/binding their account on first use)
 * and lands them in the event management.
 */
export function MagicLinkSignIn({ token, eventName, eventId, memberName }: Props) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    const res = await signIn('credentials', {
      token,
      redirect: false,
      callbackUrl: `/events/${eventId}/setup`,
    })
    if (res?.error || !res?.ok) {
      setError("Ce lien n'est plus valide. Demandez-en un nouveau à l'organisateur.")
      setBusy(false)
      return
    }
    window.location.href = res.url ?? `/events/${eventId}/setup`
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--color-bg)' }}>
      <div
        className="max-w-md w-full rounded-xl p-6 text-center"
        style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
      >
        <p className="text-[11px] uppercase tracking-wider mb-1" style={{ color: 'var(--color-ink-4)' }}>
          Accès organisateur
        </p>
        <h1 className="text-lg font-semibold leading-tight mb-1" style={{ color: 'var(--color-ink)' }}>
          {eventName}
        </h1>
        <p className="text-sm mb-5" style={{ color: 'var(--color-ink-3)' }}>
          Bonjour <strong>{memberName}</strong> 👋 — vous êtes invité·e à co-organiser cet
          événement. Aucun mot de passe : ce lien vous connecte directement.
        </p>
        <button
          type="button"
          onClick={go}
          disabled={busy}
          className="w-full px-4 py-2.5 rounded-md text-sm font-semibold transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-lime)', color: '#1a1a10' }}
        >
          {busy ? 'Connexion…' : 'Accéder à la gestion'}
        </button>
        {error && (
          <p className="text-xs mt-3" style={{ color: 'var(--color-danger, #DC2626)' }}>
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
