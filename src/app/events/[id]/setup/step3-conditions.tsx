'use client'

import { useState, useRef, useEffect } from 'react'
import type { Race, Simulation } from '@prisma/client'

export interface WeatherData {
  temperature: number
  wind: number
  windDirection: number
  rain: boolean
  rainIntensity: number
  fog: boolean
}

interface Step3ConditionsProps {
  eventId: string
  races: Race[]
  simulation: Simulation | null
  onUpdate: (w: WeatherData) => void
}

const COMPASS_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']

function tempColor(t: number): string {
  if (t <= 4) return '#38BDF8'
  if (t <= 14) return '#22D3EE'
  if (t <= 22) return 'var(--color-lime)'
  if (t <= 30) return 'var(--color-warning)'
  return 'var(--color-danger)'
}

function degToCardinal(deg: number): string {
  const idx = Math.round(((deg % 360) + 360) % 360 / 45) % 8
  return COMPASS_LABELS[idx]
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center rounded-full transition-colors shrink-0"
      style={{
        width: 40,
        height: 22,
        // Always keep a border so the box size is identical in both states
        border: `1px solid ${checked ? 'var(--color-lime)' : 'var(--color-line)'}`,
        background: checked ? 'var(--color-lime)' : 'var(--color-bg-2)',
      }}
    >
      <span
        className="rounded-full bg-white shadow-sm transition-transform"
        style={{
          width: 16,
          height: 16,
          transform: checked ? 'translateX(20px)' : 'translateX(2px)',
        }}
      />
    </button>
  )
}

export function Step3Conditions({ simulation, onUpdate }: Step3ConditionsProps) {
  const [temperature, setTemperature] = useState<number>(
    simulation?.temperature ?? 18
  )
  const [wind, setWind] = useState<number>(simulation?.wind ?? 0)
  const [windDir, setWindDir] = useState<number>(simulation?.windDirection ?? 180)
  const [rain, setRain] = useState<boolean>(simulation?.rain ?? false)
  const [rainIntensity, setRainIntensity] = useState<number>(
    simulation?.rainIntensity ?? 40
  )
  const [fog, setFog] = useState<boolean>(simulation?.fog ?? false)

  const svgRef = useRef<SVGSVGElement>(null)

  // Report the weather configuration up to the wizard whenever it changes.
  useEffect(() => {
    onUpdate({ temperature, wind, windDirection: windDir, rain, rainIntensity, fog })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [temperature, wind, windDir, rain, rainIntensity, fog])

  // State is the single source of truth; the wizard persists on launch.
  function save(_patch?: unknown) {
    void _patch
  }

  function handleWindRoseClick(e: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    const angle = Math.round(((Math.atan2(dx, -dy) * 180) / Math.PI + 360) % 360)
    setWindDir(angle)
    save({ windDirection: angle })
  }

  function handleWindRoseDrag(e: React.MouseEvent<SVGSVGElement>) {
    if (e.buttons !== 1) return
    handleWindRoseClick(e)
  }

  const arrowX = Math.sin((windDir * Math.PI) / 180) * 42
  const arrowY = -Math.cos((windDir * Math.PI) / 180) * 42

  return (
    <div className="space-y-6">
      {/* Visible draggable thumb for appearance-none range inputs */}
      <style>{`
        .ts-range::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid var(--color-lime);
          box-shadow: 0 1px 3px rgba(0,0,0,.4);
          cursor: pointer;
          margin-top: 0;
        }
        .ts-range::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 2px solid var(--color-lime);
          box-shadow: 0 1px 3px rgba(0,0,0,.4);
          cursor: pointer;
        }
      `}</style>
      <div>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--color-ink)' }}>
          Conditions météo
        </h2>
        <p className="text-sm mt-1" style={{ color: 'var(--color-ink-3)' }}>
          Définissez les conditions météorologiques pour la simulation.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Temperature card */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            border: '1px solid var(--color-line)',
            background: 'var(--color-bg-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-ink-2)' }}>
              Température
            </span>
            <span
              className="text-2xl font-bold tabular-nums"
              style={{ color: tempColor(temperature) }}
            >
              {temperature}°C
            </span>
          </div>

          <input
            type="range"
            min={-5}
            max={45}
            step={1}
            value={temperature}
            onChange={(e) => setTemperature(parseInt(e.target.value))}
            onMouseUp={(e) => save({ temperature: parseInt((e.target as HTMLInputElement).value) })}
            className="ts-range w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right,
                #38BDF8 0%,
                #22D3EE 18%,
                var(--color-lime) 36%,
                var(--color-warning) 66%,
                var(--color-danger) 100%)`,
            }}
          />

          <div className="flex justify-between text-xs" style={{ color: 'var(--color-ink-4)' }}>
            <span>-5°C</span>
            <span style={{ color: 'var(--color-ink-3)' }}>idéal 12-18°</span>
            <span>45°C</span>
          </div>
        </div>

        {/* Wind card */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            border: '1px solid var(--color-line)',
            background: 'var(--color-bg-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-ink-2)' }}>
              Vent
            </span>
            <span className="text-2xl font-bold tabular-nums" style={{ color: 'var(--color-ink)' }}>
              {wind} km/h
            </span>
          </div>

          <input
            type="range"
            min={0}
            max={80}
            step={1}
            value={wind}
            onChange={(e) => setWind(parseInt(e.target.value))}
            onMouseUp={(e) => save({ wind: parseInt((e.target as HTMLInputElement).value) })}
            className="ts-range w-full h-2 rounded-full appearance-none cursor-pointer"
            style={{
              background: `linear-gradient(to right, var(--color-lime) 0%, var(--color-lime) ${
                (wind / 80) * 100
              }%, var(--color-bg-2) ${(wind / 80) * 100}%)`,
            }}
          />

          {/* Wind rose */}
          <div className="flex flex-col items-center gap-1 pt-1">
            <span className="text-xs" style={{ color: 'var(--color-ink-4)' }}>
              Direction — {degToCardinal(windDir)} / {windDir}°
            </span>
            <svg
              ref={svgRef}
              width={110}
              height={110}
              viewBox="-55 -55 110 110"
              className="cursor-crosshair"
              onClick={handleWindRoseClick}
              onMouseMove={handleWindRoseDrag}
            >
              {/* Outer ring */}
              <circle r={50} fill="none" stroke="var(--color-line)" strokeWidth={1} />
              {/* Inner ring */}
              <circle r={42} fill="none" stroke="var(--color-bg-2)" strokeWidth={1} />
              {/* Center hub */}
              <circle r={18} fill="var(--color-bg-2)" stroke="var(--color-line)" strokeWidth={1} />

              {/* Compass ticks */}
              {Array.from({ length: 16 }, (_, i) => {
                const angle = (i * 360) / 16
                const rad = (angle * Math.PI) / 180
                const inner = 42
                const outer = i % 4 === 0 ? 50 : i % 2 === 0 ? 47 : 45
                return (
                  <line
                    key={i}
                    x1={Math.sin(rad) * inner}
                    y1={-Math.cos(rad) * inner}
                    x2={Math.sin(rad) * outer}
                    y2={-Math.cos(rad) * outer}
                    stroke="var(--color-line)"
                    strokeWidth={i % 4 === 0 ? 1.5 : 0.8}
                  />
                )
              })}

              {/* Compass labels — N/S/E/O only */}
              {COMPASS_LABELS.map((label, i) => {
                const angle = (i * 360) / 8
                const rad = (angle * Math.PI) / 180
                const r = 35
                return (
                  <text
                    key={label}
                    x={Math.sin(rad) * r}
                    y={-Math.cos(rad) * r + 3.5}
                    textAnchor="middle"
                    fontSize={6}
                    fill="var(--color-ink-4)"
                    fontFamily="var(--font-ui, sans-serif)"
                  >
                    {label}
                  </text>
                )
              })}

              {/* Wind direction arrow */}
              <line
                x1={0}
                y1={0}
                x2={arrowX}
                y2={arrowY}
                stroke="var(--color-lime)"
                strokeWidth={2.5}
                strokeLinecap="round"
              />
              <circle cx={arrowX} cy={arrowY} r={4} fill="var(--color-lime)" />
              <circle r={3} fill="var(--color-bg-1)" stroke="var(--color-lime)" strokeWidth={1.5} />
            </svg>
          </div>
        </div>

        {/* Rain card */}
        <div
          className="rounded-xl p-4 space-y-3"
          style={{
            border: '1px solid var(--color-line)',
            background: 'var(--color-bg-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-ink-2)' }}>
              Pluie
            </span>
            <Toggle
              checked={rain}
              onChange={(v) => {
                setRain(v)
                save({ rain: v })
              }}
            />
          </div>

          {rain && (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--color-ink-4)' }}>Intensité</span>
                <span style={{ color: 'var(--color-ink-2)' }}>{rainIntensity}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={rainIntensity}
                onChange={(e) => setRainIntensity(parseInt(e.target.value))}
                onMouseUp={(e) =>
                  save({ rainIntensity: parseInt((e.target as HTMLInputElement).value) })
                }
                className="ts-range w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #38BDF8 0%, #38BDF8 ${rainIntensity}%, var(--color-bg-2) ${rainIntensity}%)`,
                }}
              />
              <p className="text-xs font-medium mt-1" style={{ color: 'var(--color-warning)' }}>
                ⚠ Terrain glissant
              </p>
            </div>
          )}
        </div>

        {/* Fog card */}
        <div
          className="rounded-xl p-4"
          style={{
            border: '1px solid var(--color-line)',
            background: 'var(--color-bg-1)',
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium" style={{ color: 'var(--color-ink-2)' }}>
              Brouillard
            </span>
            <Toggle
              checked={fog}
              onChange={(v) => {
                setFog(v)
                save({ fog: v })
              }}
            />
          </div>

          {fog && (
            <p className="text-xs mt-3 font-medium" style={{ color: 'var(--color-ink-3)' }}>
              Visibilité réduite — prudence
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
