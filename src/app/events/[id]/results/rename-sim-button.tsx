'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PencilIcon } from 'lucide-react'

export function RenameSimButton({ simId, simName }: { simId: string; simName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleRename() {
    if (busy) return
    const next = window.prompt('Nom de la simulation', simName)
    if (next === null) return
    const name = next.trim()
    if (!name || name === simName) return
    setBusy(true)
    try {
      const res = await fetch(`/api/simulations/${simId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      if (res.ok) {
        router.refresh()
      } else {
        alert('Le renommage a échoué. Réessayez.')
      }
    } catch {
      alert('Erreur réseau lors du renommage.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleRename}
      disabled={busy}
      title="Renommer cette simulation"
      aria-label="Renommer cette simulation"
      className="p-1 rounded shrink-0"
      style={{ color: 'var(--color-ink-4)', cursor: busy ? 'default' : 'pointer' }}
    >
      <PencilIcon size={13} />
    </button>
  )
}
