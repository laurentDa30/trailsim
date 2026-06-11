// Per-simulation trace snapshot. Runner positions are stored as fractions
// (0–1) of the trace, so a results/report/terrain page must render the
// geometry the simulation actually ran on: projecting old positions onto a
// re-uploaded (different) trace corrupts the map and every km-based stat.

interface TraceSnapEntry {
  id: string
  // Raw JSON string, same encoding as Race.gpxPoints (copied verbatim).
  gpxPoints: string
  segments: unknown[]
}

/**
 * Replace each race's live trace + segments with the simulation's snapshot.
 * Races created after the simulation are dropped (they weren't part of the
 * run); simulations from before the snapshot existed (null) keep live data.
 */
export function applyTraceSnapshot<
  R extends { id: string; gpxPoints: string; segments: unknown[] }
>(races: R[], gpxSnapshot: string | null | undefined): R[] {
  if (!gpxSnapshot) return races
  let snaps: TraceSnapEntry[]
  try {
    snaps = JSON.parse(gpxSnapshot) as TraceSnapEntry[]
  } catch {
    return races
  }
  const byId = new Map(snaps.map((s) => [s.id, s]))
  return races
    .filter((r) => byId.has(r.id))
    .map((r) => {
      const s = byId.get(r.id)!
      return { ...r, gpxPoints: s.gpxPoints, segments: s.segments as R['segments'] }
    })
}
