'use client'

interface Props {
  eventId: string
  simId: string
  terrainHref: string
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

export function ReportToolbar({ eventId, simId, terrainHref }: Props) {
  return (
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

      <a href={terrainHref} style={{ ...btnBase, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151' }}>
        🗺 Plan terrain plein écran
      </a>

      <div style={{ flex: 1 }} />

      <button
        onClick={() => window.print()}
        style={{ ...btnBase, border: 'none', background: '#7CB518', color: '#fff', fontWeight: 600 }}
      >
        Imprimer / Exporter PDF
      </button>
    </div>
  )
}
