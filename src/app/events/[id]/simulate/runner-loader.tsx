'use client'

/**
 * Fun animated loader for the simulation screen: a runner sprinting in place
 * while the trail, trees and hills scroll past (parallax) to fake the motion.
 * Pure SVG + CSS keyframes — no JS timers. Honours prefers-reduced-motion.
 */
export function RunnerLoader() {
  return (
    <div className="absolute inset-0 overflow-hidden" aria-label="Simulation en cours">
      <style>{`
        .rl-far  { animation: rl-scroll 14s linear infinite; }
        .rl-mid  { animation: rl-scroll 7s  linear infinite; }
        .rl-near { animation: rl-scroll 3s  linear infinite; }
        @keyframes rl-scroll { from { transform: translateX(0); } to { transform: translateX(-400px); } }

        .rl-runner { animation: rl-bob 0.55s ease-in-out infinite; transform-origin: 120px 150px; }
        @keyframes rl-bob {
          0%, 100% { transform: translateY(0); }
          50%      { transform: translateY(-3.5px); }
        }
        .rl-leg-a, .rl-leg-b, .rl-arm-a, .rl-arm-b {
          transform-box: fill-box;
          transform-origin: top center;
        }
        .rl-leg-a { animation: rl-swing 0.55s ease-in-out infinite; }
        .rl-leg-b { animation: rl-swing 0.55s ease-in-out infinite; animation-delay: -0.275s; }
        .rl-arm-a { animation: rl-swing 0.55s ease-in-out infinite; animation-delay: -0.275s; }
        .rl-arm-b { animation: rl-swing 0.55s ease-in-out infinite; }
        @keyframes rl-swing {
          0%, 100% { transform: rotate(38deg); }
          50%      { transform: rotate(-38deg); }
        }
        .rl-dust { animation: rl-puff 0.55s ease-out infinite; }
        @keyframes rl-puff {
          0%   { opacity: 0;   transform: translate(0, 0) scale(0.4); }
          30%  { opacity: 0.5; }
          100% { opacity: 0;   transform: translate(-16px, -4px) scale(1.15); }
        }
        @media (prefers-reduced-motion: reduce) {
          .rl-far, .rl-mid, .rl-near, .rl-runner, .rl-leg-a, .rl-leg-b, .rl-arm-a, .rl-arm-b, .rl-dust {
            animation: none;
          }
        }
      `}</style>

      <svg
        width="100%"
        height="100%"
        viewBox="0 0 400 225"
        preserveAspectRatio="xMidYMid slice"
        className="absolute inset-0"
      >
        {/* Sun */}
        <circle cx="330" cy="42" r="18" fill="var(--color-lime)" opacity="0.25" />
        <circle cx="330" cy="42" r="11" fill="var(--color-lime)" opacity="0.5" />

        {/* Far hills (slow parallax) — pattern repeats every 400px, drawn twice */}
        <g className="rl-far" opacity="0.35">
          {[0, 400].map((dx) => (
            <path
              key={dx}
              transform={`translate(${dx},0)`}
              d="M 0 150 Q 50 95 100 125 Q 150 150 200 105 Q 250 70 300 115 Q 350 148 400 150 L 400 225 L 0 225 Z"
              fill="var(--color-ink-4)"
            />
          ))}
        </g>

        {/* Mid layer: pines (medium parallax) */}
        <g className="rl-mid" opacity="0.55">
          {[0, 400].map((dx) => (
            <g key={dx} transform={`translate(${dx},0)`} fill="var(--color-lime)">
              {[40, 150, 240, 330].map((x, i) => (
                <g key={x} transform={`translate(${x},${158 - (i % 2) * 8})`} opacity={0.5 + (i % 2) * 0.2}>
                  <path d="M 0 0 L 8 18 L -8 18 Z" />
                  <path d="M 0 8 L 10 28 L -10 28 Z" />
                  <rect x="-1.5" y="28" width="3" height="6" fill="var(--color-ink-4)" />
                </g>
              ))}
            </g>
          ))}
        </g>

        {/* Ground */}
        <rect x="0" y="186" width="400" height="39" fill="var(--color-ink-4)" opacity="0.18" />

        {/* Trail (fast parallax): dashed path + pebbles + grass */}
        <g className="rl-near">
          {[0, 400].map((dx) => (
            <g key={dx} transform={`translate(${dx},0)`}>
              <path
                d="M 0 192 Q 100 188 200 192 T 400 192"
                fill="none"
                stroke="var(--color-ink-3)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeDasharray="16 14"
                opacity="0.7"
              />
              {[30, 120, 205, 290, 360].map((x, i) => (
                <circle key={x} cx={x} cy={199 + (i % 3) * 4} r={1.6 + (i % 2)} fill="var(--color-ink-4)" opacity="0.5" />
              ))}
              {[70, 175, 255, 340].map((x) => (
                <path
                  key={x}
                  d={`M ${x} 188 q 1.5 -6 3 0 M ${x + 3} 188 q 1.5 -5 3 0`}
                  stroke="var(--color-lime)"
                  strokeWidth="1.2"
                  fill="none"
                  opacity="0.6"
                />
              ))}
            </g>
          ))}
        </g>

        {/* Runner — runs in place, the world scrolls past */}
        <g className="rl-runner">
          {/* dust puffs behind the feet */}
          <circle className="rl-dust" cx="106" cy="188" r="4" fill="var(--color-ink-4)" />

          <g stroke="var(--color-lime)" strokeWidth="3.5" strokeLinecap="round" fill="none">
            {/* back arm (behind torso) */}
            <g className="rl-arm-b" opacity="0.55">
              <path d="M 119 150 L 112 161 L 117 169" />
            </g>
            {/* back leg */}
            <g className="rl-leg-b" opacity="0.55">
              <path d="M 117 166 L 110 177 L 114 188" />
            </g>
            {/* torso, leaning forward */}
            <path d="M 113 168 L 121 147" />
            {/* front leg */}
            <g className="rl-leg-a">
              <path d="M 117 166 L 126 176 L 124 188" />
            </g>
            {/* front arm */}
            <g className="rl-arm-a">
              <path d="M 119 150 L 128 158 L 136 154" />
            </g>
          </g>
          {/* head */}
          <circle cx="124" cy="140" r="7" fill="var(--color-lime)" />
          {/* cap visor for style */}
          <path d="M 126 136 l 8 2" stroke="var(--color-lime)" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  )
}
