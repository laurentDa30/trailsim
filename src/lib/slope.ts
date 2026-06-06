// Steepness colour scale, shared by the elevation profile and the setup map.
// Uses absolute slope (uphill or downhill steepness).

export interface SlopeStop {
  max: number // upper bound of |slope| in %
  color: string
  label: string
}

export const SLOPE_STOPS: SlopeStop[] = [
  { max: 4, color: '#22C55E', label: 'Plat (<4%)' },
  { max: 8, color: '#A3E635', label: 'Roulant (4–8%)' },
  { max: 12, color: '#F59E0B', label: 'Raide (8–12%)' },
  { max: 18, color: '#EA580C', label: 'Très raide (12–18%)' },
  { max: Infinity, color: '#DC2626', label: 'Mur (>18%)' },
]

export function slopeColor(slopePct: number): string {
  const a = Math.abs(slopePct)
  for (const s of SLOPE_STOPS) {
    if (a < s.max) return s.color
  }
  return SLOPE_STOPS[SLOPE_STOPS.length - 1].color
}
