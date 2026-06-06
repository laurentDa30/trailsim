// Narrow / technical section presets. `widthRatio` feeds the engine's segment
// capacity (lower = fewer runners abreast = a queue forms sooner); `techLevel`
// adds a small speed penalty; `influenceM` is how long the constrained stretch
// is, centred on the placed point.

export interface ConstraintPreset {
  type: string
  label: string
  description: string
  color: string
  letter: string
  widthRatio: number
  techLevel: number
  influenceM: number
}

export const CONSTRAINT_PRESETS: ConstraintPreset[] = [
  {
    type: 'SINGLE',
    label: 'Single-track',
    description: '1 file — on ne double pas',
    color: '#DC2626',
    letter: 'S',
    widthRatio: 0.18,
    techLevel: 3,
    influenceM: 200,
  },
  {
    type: 'NARROW',
    label: 'Étroit',
    description: '2 de front — dépassement difficile',
    color: '#D97706',
    letter: 'É',
    widthRatio: 0.38,
    techLevel: 2,
    influenceM: 200,
  },
  {
    type: 'TECHNIQUE',
    label: 'Technique',
    description: 'Ralentit sans bloquer (pierrier, gué…)',
    color: '#A78BFA',
    letter: 'T',
    widthRatio: 0.6,
    techLevel: 4,
    influenceM: 150,
  },
]

// Ravito / aid station — a stop point on the course (not a capacity constraint)
export const RAVITO_PRESET: ConstraintPreset = {
  type: 'RAVITO',
  label: 'Ravitaillement',
  description: 'Point de ravito / contrôle (arrêt)',
  color: '#22D3EE',
  letter: 'R',
  widthRatio: 0.5,
  techLevel: 0,
  influenceM: 0,
}

export const ALL_PRESETS = [...CONSTRAINT_PRESETS, RAVITO_PRESET]

export function isRavito(type: string): boolean {
  return type === 'RAVITO'
}

export function presetOf(type: string): ConstraintPreset {
  return ALL_PRESETS.find((p) => p.type === type) ?? CONSTRAINT_PRESETS[0]
}
