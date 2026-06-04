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

  for (const profile of profiles) {
    const count = Math.round(totalRunners * (profile.percentage / 100))
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
        color: profile.color,
      })
    }
  }

  return runners
}
