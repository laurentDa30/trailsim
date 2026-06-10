/**
 * Seedable RNG for the simulation engine (mulberry32).
 *
 * Every stochastic draw in the engine goes through rand() so that a run can be
 * replayed exactly from its seed: same peloton, same abandons, same noise.
 * Unseeded, rand() falls back to Math.random (legacy behaviour).
 */

let current: () => number = Math.random

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rand(): number {
  return current()
}

export function seedRng(seed: number): void {
  current = mulberry32(seed)
}

/** Draw a fresh random seed (also used when the caller didn't provide one). */
export function newSeed(): number {
  return Math.floor(Math.random() * 0x7fffffff)
}
