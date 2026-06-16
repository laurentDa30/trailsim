import { gzipSync, gunzipSync } from "node:zlib"

// Per-simulation trace snapshot. Runner positions are stored as fractions
// (0–1) of the trace, so a results/report/terrain page must render the
// geometry the simulation actually ran on: projecting old positions onto a
// re-uploaded (different) trace corrupts the map and every km-based stat.

// ── resultSnapshot storage codec ───────────────────────────────────────────
// A peloton's trajectories are several MB of JSON. Stored verbatim in Postgres,
// every results/report/terrain/compare page read pulls those MBs over the wire
// and burns the DB data-transfer quota. Trajectories gzip ×8–15, so we store
// them gzipped (base64) AT REST and inflate on read. Legacy rows are plain
// JSON — detected by their first char ('{' / '[') — so reads stay backward
// compatible without a migration. Server-only (node:zlib).

/** gzip + base64 a JS value for at-rest storage in a text column. */
export function encodeSnapshot(value: unknown): string {
  return gzipSync(Buffer.from(JSON.stringify(value), "utf8")).toString("base64")
}

/** Inflate a stored snapshot back to its JSON string (handles legacy plain JSON). */
export function decodeSnapshotString(stored: string | null | undefined): string | null {
  if (!stored) return null
  const c = stored[0]
  // Legacy rows were stored as raw JSON.
  if (c === "{" || c === "[") return stored
  try {
    return gunzipSync(Buffer.from(stored, "base64")).toString("utf8")
  } catch {
    return null
  }
}

/** Inflate + JSON.parse a stored snapshot into a typed object, or null on failure. */
export function decodeSnapshot<T = unknown>(stored: string | null | undefined): T | null {
  const json = decodeSnapshotString(stored)
  if (json == null) return null
  try {
    return JSON.parse(json) as T
  } catch {
    return null
  }
}

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
