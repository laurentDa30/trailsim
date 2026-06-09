'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2Icon } from 'lucide-react'

export function DeleteSimButton({ simId, simName }: { simId: string; simName: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (busy) return
    if (!confirm(`Supprimer la simulation « ${simName} » ? Cette action est définitive.`)) return
    setBusy(true)
    try {
      const res = await fetch(`/api/simulations/${simId}`, { method: 'DELETE' })
      if (res.ok) {
        router.refresh()
      } else {
        alert('La suppression a échoué. Réessayez.')
        setBusy(false)
      }
    } catch {
      alert('Erreur réseau lors de la suppression.')
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      title="Supprimer cette simulation"
      aria-label="Supprimer cette simulation"
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
      style={{
        background: 'transparent',
        border: '1px solid var(--color-line)',
        color: 'var(--color-ink-4)',
        opacity: busy ? 0.5 : 1,
        cursor: busy ? 'default' : 'pointer',
      }}
    >
      <Trash2Icon size={13} />
      {busy ? 'Suppression…' : 'Supprimer'}
    </button>
  )
}
