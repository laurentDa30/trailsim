/**
 * Slope speed multiplier relative to flat running, based on Tobler's hiking
 * function: speed peaks at a gentle −5% downhill and falls off on both sides.
 * Monotonic away from the peak, so steeper climbs and descents are always
 * slower (the previous quadratic wrongly sped up very steep climbs).
 *
 * The falloff exponent is 2.2 (not Tobler's original 3.5, which is tuned for
 * hikers): trail runners lose less on moderate climbs and recover more on
 * runnable descents than walkers do. Calibrated against real results (10km
 * leader ~14 km/h on moderate D+, ~12-13 on steeper): a +10% climb costs ~20%
 * and a runnable −10% descent gives back speed instead of being neutral, so
 * hilly courses aren't over-slowed.
 *
 * slopePct: slope in percent (positive = uphill)
 */
export function getMinettiSlopeFactor(slopePct: number): number {
  const i = slopePct / 100
  const factor = Math.exp(-2.2 * (Math.abs(i + 0.05) - 0.05))
  return Math.max(0.12, Math.min(1.35, factor))
}

/**
 * Compute instantaneous speed (km/h) for a runner given all modifying factors.
 *
 * @param baseSpeed       - runner's flat-terrain base speed (km/h)
 * @param slopePct        - current slope in percent (positive = uphill)
 * @param densityFactor   - crowd density slowdown factor (0.15–1.0)
 * @param fatigueFactor   - fatigue slowdown factor (baseFloor–1.0)
 * @param weatherFactor   - weather slowdown factor (0.3–1.0)
 * @param terrainFactor   - terrain/technicality factor (0.5–1.0)
 * @returns speed in km/h, clamped to [0.5, baseSpeed * 1.35]
 */
export function computeSpeed(
  baseSpeed: number,
  slopePct: number,
  densityFactor: number,
  fatigueFactor: number,
  weatherFactor: number,
  terrainFactor: number
): number {
  const slopeMod = getMinettiSlopeFactor(slopePct)
  const noise = 1 + (Math.random() - 0.5) * 0.06
  const raw =
    baseSpeed *
    slopeMod *
    fatigueFactor *
    weatherFactor *
    terrainFactor *
    densityFactor *
    noise
  return Math.max(0.5, Math.min(baseSpeed * 1.35, raw))
}

/**
 * Compute fatigue factor based on accumulated effort.
 *
 * @param distanceDone   - km already covered
 * @param elevGainDone   - metres of elevation gain done
 * @param totalDistance  - total race distance in km
 * @param totalElevGain  - total positive elevation gain in metres
 * @param baseFloor      - minimum fatigue floor (0–1, from runner profile)
 * @returns fatigue factor in [baseFloor, 1.0]
 */
export function computeFatigueFactor(
  distanceDone: number,
  elevGainDone: number,
  totalDistance: number,
  totalElevGain: number,
  baseFloor: number
): number {
  const distProg = totalDistance > 0 ? distanceDone / totalDistance : 0
  const elevProg = totalElevGain > 0 ? elevGainDone / totalElevGain : 0
  const effort = distProg * 0.7 + elevProg * 0.3
  if (effort < 0.4) return 1.0
  const decay = Math.pow(effort - 0.4, 1.5) * 0.6
  return Math.max(baseFloor, 1.0 - decay)
}
