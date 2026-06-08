'use client'

import { useState } from 'react'
import { OperationalMap, type OpMapRace, type OpMapZone } from '../../report/[simId]/operational-map'

interface Props {
  eventId: string
  simId: string
  eventName: string
  simName: string
  races: OpMapRace[]
  zones: OpMapZone[]
}

const btnBase: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  padding: '6px 14px',
  borderRadius: '6px',
  fontSize: '13px',
  fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
}

export function TerrainView({ eventId, simId, eventName, simName, races, zones }: Props) {
  const [showInventory, setShowInventory] = useState(true)

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', fontFamily: "'Inter', system-ui, sans-serif", color: '#111827' }}>
      <style>{`
        @media print {
          body { background: white; }
          .no-print { display: none !important; }
          .terrain-sheet { box-shadow: none !important; margin: 0 !important; max-width: none !important; }
        }
        @page { size: A4 landscape; margin: 10mm; }
      `}</style>

      {/* Toolbar */}
      <div
        className="no-print"
        style={{
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        <a href={`/events/${eventId}/results/${simId}`} style={{ ...btnBase, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
          ← Résultats
        </a>
        <a href={`/events/${eventId}/report/${simId}`} style={{ ...btnBase, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
          Rapport complet
        </a>

        <div style={{ marginLeft: 8, fontSize: 13, color: '#6b7280' }}>
          <strong style={{ color: '#374151' }}>{eventName}</strong> · Plan terrain — {simName}
        </div>

        <div style={{ flex: 1 }} />

        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#374151', cursor: 'pointer' }}>
          <input type="checkbox" checked={showInventory} onChange={(e) => setShowInventory(e.target.checked)} />
          Inventaire
        </label>

        <button onClick={() => window.print()} style={{ ...btnBase, border: 'none', background: '#7CB518', color: '#fff', fontWeight: 600 }}>
          Imprimer (A4)
        </button>
      </div>

      {/* Sheet */}
      <div
        className="terrain-sheet"
        style={{
          maxWidth: 1180,
          margin: '24px auto',
          background: '#fff',
          padding: 24,
          borderRadius: 12,
          boxShadow: '0 4px 32px rgba(0,0,0,0.10)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Plan d&apos;implantation — jour J</h1>
          <span style={{ fontSize: 12, color: '#9ca3af' }}>{eventName}</span>
        </div>
        <OperationalMap simId={simId} races={races} zones={zones} height={620} showInventory={showInventory} />
      </div>
    </div>
  )
}
