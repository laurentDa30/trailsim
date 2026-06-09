import type { Runner, RunnerProfile } from './types'

/**
 * Generate a list of Runner instances from race profiles.
 *
 * For each profile, spawns round(totalRunners * percentage/100) runners
 * with base speeds uniformly sampled in [baseSpeedMin, baseSpeedMax].
 *
 * @param profiles      - array of RunnerProfile definitions
 * @param raceId        - the race these runners belong to
 * @param totalRunners  - total number of runners in the race
 * @returns array of Runner objects ready for simulation
 */
export function createRunnersFromProfiles(
  profiles: RunnerProfile[],
  raceId: string,
  totalRunners: number
): Runner[] {
  const runners: Runner[] = []
  let runnerIndex = 0

  // Largest-remainder apportionment so the spawned count matches the configured
  // total exactly (when percentages sum to 100). Plain per-profile rounding
  // drifts — e.g. 150 runners on the default mix would yield 152.
  const sumPct = profiles.reduce((s, p) => s + p.percentage, 0)
  const target = sumPct > 0 ? Math.round(totalRunners * (sumPct / 100)) : 0
  const exact = profiles.map((p) => (sumPct > 0 ? totalRunners * (p.percentage / 100) : 0))
  const counts = exact.map((e) => Math.floor(e))
  let remaining = target - counts.reduce((s, c) => s + c, 0)
  const order = exact
    .map((e, i) => ({ i, frac: e - Math.floor(e) }))
    .sort((a, b) => b.frac - a.frac)
  for (let k = 0; k < order.length && remaining > 0; k++, remaining--) counts[order[k].i]++

  for (let pi = 0; pi < profiles.length; pi++) {
    const profile = profiles[pi]
    const count = counts[pi]
    for (let i = 0; i < count; i++) {
      const t = Math.random()
      const baseSpeed =
        profile.baseSpeedMin + t * (profile.baseSpeedMax - profile.baseSpeedMin)

      runners.push({
        id: `${raceId}-${profile.id}-${runnerIndex++}`,
        raceId,
        profileLabel: profile.label,
        baseSpeed,
        climbCoeff: profile.climbCoeff,
        descentCoeff: profile.descentCoeff,
        fatigueFactor: profile.fatigueFactor,
        techSkill: profile.techSkill,
        ravitoDuration: profile.ravitoDuration,
        abandonRate: profile.abandonRate,
        color: profile.color,
      })
    }
  }

  return runners
}
