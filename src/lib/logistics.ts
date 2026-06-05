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

export function logiStorageKey(simId: string): string {
  return `ts_logi_placed:${simId}`
}
