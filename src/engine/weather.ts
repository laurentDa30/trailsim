export interface WeatherParams {
  temperature: number     // °C
  wind: number            // km/h
  windDirection: number   // degrees (0=N, 90=E, 180=S, 270=W)
  rain: boolean
  rainIntensity: number   // 0–1
  fog: boolean
}

/**
 * Compute a weather speed factor for a runner at a given point.
 *
 * @param aspect      - direction of travel in degrees (0=N, 90=E)
 * @param slopePct    - current slope in percent
 * @param techSkill   - runner's technical skill 0–1 (higher = less rain penalty)
 * @param params      - weather configuration
 * @returns speed factor in [0.3, 1.0]
 */
export function computeWeather(
  aspect: number,
  slopePct: number,
  techSkill: number,
  params: WeatherParams
): number {
  let factor = 1.0

  // ---- Heat penalty ----
  // -2.5% per degree above 22°C, doubled on slopes steeper than 6%
  if (params.temperature > 22) {
    const heatDelta = params.temperature - 22
    let heatPenalty = heatDelta * 0.025
    if (Math.abs(slopePct) > 6) heatPenalty *= 2
    factor -= heatPenalty
  }

  // ---- Wind penalty ----
  // Compute dot product of wind direction vs movement direction.
  // A headwind (dot = 1) gives the maximum penalty; tailwind (dot = -1) gives a small bonus.
  if (params.wind > 0) {
    // Convert both directions to unit vectors on the horizontal plane
    const windRad = (params.windDirection * Math.PI) / 180
    const aspectRad = (aspect * Math.PI) / 180

    // Wind vector: direction the wind is blowing FROM → invert to get impacting direction
    const windDx = Math.sin(windRad)
    const windDy = Math.cos(windRad)
    const moveDx = Math.sin(aspectRad)
    const moveDy = Math.cos(aspectRad)

    // Dot product: +1 = full headwind, -1 = full tailwind
    const dot = windDx * moveDx + windDy * moveDy

    // Scale: 30 km/h headwind ≈ -6% speed; tailwind gives up to +2%
    const windEffect = (dot * params.wind) / 30
    factor -= windEffect * 0.06
  }

  // ---- Rain penalty ----
  if (params.rain && params.rainIntensity > 0) {
    factor -= 0.08 * params.rainIntensity
    // Low-skill runners suffer extra penalty from rain (footing, confidence)
    if (techSkill < 0.7) {
      factor -= 0.10 * params.rainIntensity * (1 - techSkill / 0.7)
    }
  }

  // ---- Fog penalty ----
  if (params.fog) {
    factor -= 0.05
  }

  // Clamp to [0.3, 1.0]
  return Math.max(0.3, Math.min(1.0, factor))
}
