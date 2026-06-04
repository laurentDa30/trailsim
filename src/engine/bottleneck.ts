/**
 * Compute the runner capacity of a trail segment.
 *
 * @param widthRatio    - width of trail relative to a reference (0–1, 1 = wide trail)
 * @param lengthMeters  - length of the segment in metres
 * @returns maximum comfortable runner count before crowding effects kick in
 */
export function computeSegmentCapacity(widthRatio: number, lengthMeters: number): number {
  return Math.max(1, Math.floor(widthRatio * 2 * (lengthMeters / 3)))
}

/**
 * Compute the density slowdown factor for a segment.
 *
 * When runner count exceeds capacity, each additional 10% over-capacity
 * reduces speed by ~4%, down to a floor of 0.15 (near-standstill jam).
 *
 * @param count    - number of runners currently in the segment
 * @param capacity - segment capacity from computeSegmentCapacity
 * @returns density factor in [0.15, 1.0]
 */
export function computeDensityFactor(count: number, capacity: number): number {
  if (count <= capacity) return 1.0
  const ratio = count / capacity
  return Math.max(0.15, 1.0 - (ratio - 1.0) * 0.4)
}
