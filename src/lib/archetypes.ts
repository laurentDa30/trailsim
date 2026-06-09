/**
 * Runner archetype presets and peloton-config types.
 *
 * Kept free of React so both the setup wizard (view) and the simulation
 * runner (engine glue) can import the same single source of truth for runner
 * speed bands and physical tuning.
 */

// Default per-archetype proportions are calibrated on the real finisher data of
// the reference event (results 10 km + 20 km, ~640 arrivants): blended average
// of the two courses' speed-band distribution, rounded to 100 %.
//   Élite 1 · Confirmé 9 · Intermédiaire 39 · Débutant 42 · Marcheur 9
// Organisers can still adjust per race in step 2; saved configs keep their own.
// Abandon rates are tuned to half the raw observed DNF rate (calib v3), and the
// Marcheur floor speed is 5 km/h (a sustained fast-walk minimum).
export const DEFAULT_ARCHETYPES = [
  {
    id: 'elite',
    label: 'Élite',
    color: '#7CB518',
    percentage: 1,
    speedMin: 13,
    speedMax: 18,
    fatiguePlancher: 80,
    techLevel: 95,
    ravito: 30,
    abandon: 1,
  },
  {
    id: 'confirme',
    label: 'Confirmé',
    color: '#38BDF8',
    percentage: 9,
    speedMin: 10,
    speedMax: 13,
    fatiguePlancher: 70,
    techLevel: 75,
    ravito: 60,
    abandon: 2.5,
  },
  {
    id: 'intermediaire',
    label: 'Intermédiaire',
    color: '#FBBF24',
    percentage: 39,
    speedMin: 8,
    speedMax: 11,
    fatiguePlancher: 60,
    techLevel: 55,
    ravito: 90,
    abandon: 4,
  },
  {
    id: 'debutant',
    label: 'Débutant',
    color: '#F472B6',
    percentage: 42,
    speedMin: 6,
    speedMax: 8,
    fatiguePlancher: 50,
    techLevel: 40,
    ravito: 120,
    abandon: 6,
  },
  {
    id: 'marcheur',
    label: 'Marcheur',
    color: '#A78BFA',
    percentage: 9,
    speedMin: 5,
    speedMax: 6,
    fatiguePlancher: 40,
    techLevel: 25,
    ravito: 180,
    abandon: 7.5,
  },
]

export type Archetype = typeof DEFAULT_ARCHETYPES[number]

export interface RaceConfig {
  totalRunners: number
  archetypes: Archetype[]
}

export type PelotonConfigs = Record<string, RaceConfig>

/**
 * Bumped whenever the archetype calibration (speed bands, fatigue, etc.)
 * changes in DEFAULT_ARCHETYPES. A saved peloton tagged with an older version
 * is refreshed once to the new tuning (keeping the organiser's distribution),
 * so central recalibrations apply automatically without manual slider edits.
 */
export const PELOTON_CALIB_VERSION = 3

/**
 * Re-apply the current DEFAULT_ARCHETYPES tuning (speeds + physical params) to
 * a saved config, preserving only the organiser's choices: per-race
 * totalRunners and per-archetype percentage. Custom archetypes (not among the
 * defaults) are kept untouched.
 */
export function refreshArchetypeTuning(configs: PelotonConfigs): PelotonConfigs {
  const byId = new Map(DEFAULT_ARCHETYPES.map((a) => [a.id, a]))
  const out: PelotonConfigs = {}
  for (const [raceId, cfg] of Object.entries(configs)) {
    out[raceId] = {
      totalRunners: cfg.totalRunners,
      archetypes: (cfg.archetypes ?? []).map((a) => {
        const def = byId.get(a.id)
        if (!def) return { ...a } // custom archetype → keep as-is
        return { ...def, percentage: a.percentage }
      }),
    }
  }
  return out
}
