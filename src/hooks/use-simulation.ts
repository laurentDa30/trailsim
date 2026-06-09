'use client'

import { useState, useCallback, useRef } from 'react'
import type { SimConfig, CompressedSimulationResult, WorkerMessage } from '@/engine/types'

// ---------------------------------------------------------------------------
// Shared state shape (kept for backward compatibility with simulate/page.tsx)
// ---------------------------------------------------------------------------

export interface SimulationState {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: number              // 0-100
  currentRun: number
  totalRuns: number
  logs: string[]
  result: CompressedSimulationResult | null
  error: string | null
  zonesDetected: number
  runnersSimulated: number
  precision: number
  estimatedSecondsLeft: number
}

const INITIAL_STATE: SimulationState = {
  status: 'idle',
  progress: 0,
  currentRun: 0,
  totalRuns: 100,
  logs: [],
  result: null,
  error: null,
  zonesDetected: 0,
  runnersSimulated: 0,
  precision: 0,
  estimatedSecondsLeft: 0,
}

// ---------------------------------------------------------------------------
// Main hook – uses the real Web Worker engine
// ---------------------------------------------------------------------------

/**
 * useSimulation
 *
 * Manages the TrailSim Web Worker lifecycle:
 * - Spawns a module Worker pointing at simulation.worker.ts
 * - Feeds real PROGRESS messages into SimulationState
 * - Exposes the same { state, run, reset } interface used by the simulate page
 *
 * The `logLines` array is consumed client-side (the worker does not produce
 * text logs) so they are drip-fed proportionally to progress, just like before.
 */
export function useSimulation() {
  // Always start clean. A stale result must never be restored across events:
  // the simulate page auto-saves `state.result` to the DB as soon as it sees
  // `status: 'done'`, so a restored result would clobber a fresh simulation
  // with another run's runners/collision windows ("Course supprimée").
  const [state, setState] = useState<SimulationState>(INITIAL_STATE)

  const workerRef = useRef<Worker | null>(null)
  const startTimeRef = useRef<number>(0)
  const logIndexRef = useRef<number>(0)
  const logLinesRef = useRef<string[]>([])

  const run = useCallback((config: SimConfig, logLines: string[] = []) => {
    // Kill any previous worker
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }

    logLinesRef.current = logLines
    logIndexRef.current = 0
    startTimeRef.current = Date.now()

    const totalRunners = config.races.reduce((s, r) => s + r.totalRunners, 0)

    setState({
      ...INITIAL_STATE,
      status: 'running',
      totalRuns: config.nRuns,
    })

    let worker: Worker
    try {
      worker = new Worker(
        new URL('../engine/simulation.worker.ts', import.meta.url),
        { type: 'module' }
      )
    } catch (err) {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: `Failed to create worker: ${String(err)}`,
      }))
      return
    }

    workerRef.current = worker

    worker.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const msg = e.data

      if (msg.type === 'PROGRESS') {
        const pct = msg.total > 0 ? Math.round((msg.run / msg.total) * 100) : 0
        const elapsed = (Date.now() - startTimeRef.current) / 1000
        const progressFrac = pct / 100
        const rate = elapsed > 0 ? progressFrac / elapsed : 0
        const remaining = rate > 0 ? Math.ceil((1 - progressFrac) / rate) : 0

        // Drip-feed log lines proportional to progress
        const targetLogIdx = Math.floor(progressFrac * logLinesRef.current.length)
        const newLogs: string[] = []
        while (logIndexRef.current < targetLogIdx && logIndexRef.current < logLinesRef.current.length) {
          newLogs.push(logLinesRef.current[logIndexRef.current++])
        }

        setState(prev => ({
          ...prev,
          status: 'running',
          progress: pct,
          currentRun: msg.run,
          totalRuns: msg.total,
          logs: newLogs.length > 0 ? [...prev.logs, ...newLogs] : prev.logs,
          zonesDetected: Math.floor(progressFrac * 12),
          runnersSimulated: Math.floor(totalRunners * progressFrac),
          // Monte-Carlo precision ≈ 1 − 1/√(runs done): tightens as runs accrue
          precision: parseFloat(((1 - 1 / Math.sqrt(Math.max(1, msg.run))) * 100).toFixed(1)),
          estimatedSecondsLeft: remaining,
        }))
      }

      if (msg.type === 'DONE') {
        const result = msg.result

        // Flush remaining log lines
        const remainingLogs = logLinesRef.current.slice(logIndexRef.current)

        setState(prev => ({
          ...prev,
          status: 'done',
          progress: 100,
          currentRun: prev.totalRuns,
          logs: [...prev.logs, ...remainingLogs],
          result,
          zonesDetected: result.riskMap?.length ?? 12,
          runnersSimulated: totalRunners,
          precision: parseFloat(((1 - 1 / Math.sqrt(Math.max(1, prev.totalRuns))) * 100).toFixed(1)),
          estimatedSecondsLeft: 0,
          error: null,
        }))

        worker.terminate()
        workerRef.current = null
      }

      if (msg.type === 'ERROR') {
        setState(prev => ({
          ...prev,
          status: 'error',
          error: msg.message,
        }))
        worker.terminate()
        workerRef.current = null
      }
    }

    worker.onerror = (e: ErrorEvent) => {
      setState(prev => ({
        ...prev,
        status: 'error',
        error: e.message ?? 'Unknown worker error',
      }))
      worker.terminate()
      workerRef.current = null
    }

    // Start the simulation
    worker.postMessage({ type: 'START', config } satisfies WorkerMessage)
  }, [])

  const reset = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate()
      workerRef.current = null
    }
    setState(INITIAL_STATE)
  }, [])

  return { state, run, reset }
}

// ---------------------------------------------------------------------------
// Simpler hook variant – for components that just need status / result
// ---------------------------------------------------------------------------

export interface UseSimulationSimpleReturn {
  status: SimulationState['status']
  progress: number
  result: CompressedSimulationResult | null
  error: string | null
  start: (config: SimConfig) => void
  reset: () => void
}

/**
 * useSimulationSimple
 *
 * Lightweight wrapper around useSimulation that exposes a cleaner
 * { status, progress, result, error, start, reset } interface.
 */
export function useSimulationSimple(): UseSimulationSimpleReturn {
  const { state, run, reset } = useSimulation()
  return {
    status: state.status,
    progress: state.progress,
    result: state.result,
    error: state.error,
    start: (config: SimConfig) => run(config, []),
    reset,
  }
}
