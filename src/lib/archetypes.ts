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
//
// Speed bands (calib v4) are FLAT base speeds, not observed race speeds: the
// engine multiplies them by slope (Tobler) + fatigue, ≈ ×0.80–0.83 on the
// reference 20 km. v3 wrongly used observed average race speeds as flat bases,
// double-counting that penalty — the median finished ~40 min late and the last
// ~1 h late. v4 bands = real quantile speeds (322 finishers, 20 km) divided by
// the engine multiplier, so simulated quantiles match reality:
//   p0 1h31→1h31 · p10 2h00→1h59 · p50 2h26→2h26 · p90 3h06→3h01 · last 3h53→4h00
// Abandon rates stay tuned to half the raw observed DNF rate.
export const DEFAULT_ARCHETYPES = [
  {
    id: 'elite',
    label: 'Élite',
    color: '#7CB518',
    percentage: 1,
    speedMin: 14.5,
    speedMax: 17,
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
    speedMin: 12.5,
    speedMax: 14.5,
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
    speedMin: 10,
    speedMax: 12.5,
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
    speedMin: 8,
    speedMax: 10,
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
    speedMin: 6,
    speedMax: 8,
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
export const PELOTON_CALIB_VERSION = 4

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
