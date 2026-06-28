'use client'

import { useState } from 'react'
import { Share2Icon, CheckIcon, LinkIcon, XIcon } from 'lucide-react'

const btn =
  'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors'

export function ShareSimButton({
  simId,
  initialToken,
}: {
  simId: string
  initialToken: string | null
}) {
  const [token, setToken] = useState<string | null>(initialToken)
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt('Copiez le lien de partage :', url)
    }
  }

  async function setShare(on: boolean) {
    if (busy) return
    if (!on && !confirm('Désactiver le lien de partage ? Il ne sera plus accessible.')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/simulations/${simId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ share: on }),
      })
      if (res.ok) {
        const d = (await res.json()) as { shareToken: string | null }
        setToken(d.shareToken)
        if (on && d.shareToken) await copy(`${window.location.origin}/r/${d.shareToken}`)
      } else {
        alert('Action impossible. Réessayez.')
      }
    } catch {
      alert('Erreur réseau.')
    } finally {
      setBusy(false)
    }
  }

  if (!token) {
    return (
      <button
        type="button"
        onClick={() => setShare(true)}
        disabled={busy}
        title="Créer un lien de partage en lecture seule"
        className={btn}
        style={{ background: 'var(--color-bg-2)', border: '1px solid var(--color-line)', color: 'var(--color-ink-2)', opacity: busy ? 0.5 : 1 }}
      >
        <Share2Icon size={13} />
        Partager
      </button>
    )
  }

  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => copy(`${window.location.origin}/r/${token}`)}
        title="Copier le lien public (lecture seule)"
        className={btn}
        style={{ background: 'color-mix(in oklab, var(--color-lime) 14%, transparent)', border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)', color: 'var(--color-lime)' }}
      >
        {copied ? <CheckIcon size={13} /> : <LinkIcon size={13} />}
        {copied ? 'Lien copié' : 'Copier le lien'}
      </button>
      <button
        type="button"
        onClick={() => setShare(false)}
        disabled={busy}
        title="Désactiver le partage"
        aria-label="Désactiver le partage"
        className="p-1.5 rounded-lg"
        style={{ border: '1px solid var(--color-line)', color: 'var(--color-ink-4)' }}
      >
        <XIcon size={13} />
      </button>
    </div>
  )
}
