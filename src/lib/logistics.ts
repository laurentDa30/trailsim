export interface LogiType {
  type: string
  label: string
  letter: string
  color: string
}

export interface PlacedLogi {
  id: string
  type: string
  lat: number
  lng: number
  /** Optional custom name overriding the type label (e.g. "Poste croix 4×4"). */
  label?: string
  /** Assigned EventMember id, or null/undefined when the poste is still vacant
   *  ("à pourvoir"). */
  memberId?: string | null
}

export const LOGI_TYPES: LogiType[] = [
  { type: 'signaleur', label: 'Signaleur', letter: 'S', color: '#38BDF8' },
  { type: 'benevole', label: 'Bénévole', letter: 'B', color: '#7CB518' },
  { type: 'barrage', label: 'Barrage', letter: 'R', color: '#D97706' },
  { type: 'medical', label: 'Médical', letter: 'M', color: '#DC2626' },
  { type: 'chrono', label: 'Chrono', letter: 'C', color: '#A78BFA' },
]

export function logiTypeOf(type: string): LogiType {
  return LOGI_TYPES.find((t) => t.type === type) ?? LOGI_TYPES[0]
}

/** Display name for a placed item: its custom label if set, else the type label. */
export function logiDisplayName(l: PlacedLogi): string {
  const custom = l.label?.trim()
  return custom && custom.length > 0 ? custom : logiTypeOf(l.type).label
}

/**
 * Numbered display names for a whole set: unnamed items get "Signaleur 1",
 * "Signaleur 2"… in placement order, so each marker is identifiable on the map
 * and in the staffing list. Custom labels win and still consume their number
 * (numbering stays stable when someone gets renamed).
 */
export function logiNumberedNames(list: PlacedLogi[]): Map<string, string> {
  const counters: Record<string, number> = {}
  const out = new Map<string, string>()
  for (const l of list) {
    counters[l.type] = (counters[l.type] ?? 0) + 1
    const custom = l.label?.trim()
    out.set(
      l.id,
      custom && custom.length > 0 ? custom : `${logiTypeOf(l.type).label} ${counters[l.type]}`
    )
  }
  return out
}

export function logiStorageKey(simId: string): string {
  return `ts_logi_placed:${simId}`
}
