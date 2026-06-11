import { BarChart2, MapPin, Users } from "lucide-react"
import { LoginForm } from "./login-form"

const TRAIL_D =
  "M 52 860 C 62 840 78 820 82 810 C 88 800 102 785 112 770 C 122 755 128 740 132 720" +
  " C 136 706 122 696 112 686 C 100 675 80 680 80 692 C 80 702 92 706 95 700" +
  " C 98 694 106 680 112 666 C 118 652 132 638 142 620 C 152 605 166 592 171 580" +
  " C 177 568 184 555 186 540 C 190 526 186 511 182 498 C 178 484 178 469 186 456" +
  " C 192 444 193 433 191 421 C 189 411 193 401 199 393 C 206 383 217 375 227 370" +
  " C 237 366 250 360 262 355 C 274 350 285 344 296 338 C 308 332 320 325 331 318" +
  " C 343 311 356 302 366 292 C 377 282 387 270 393 258 C 401 246 410 233 414 220" +
  " C 419 208 420 200 417 192 C 414 184 419 175 427 172 C 435 169 446 170 455 178" +
  " C 464 186 473 199 476 213 C 479 227 477 243 469 257 C 461 271 453 285 456 300" +
  " C 459 316 469 330 476 346 C 483 361 490 377 492 393"

export default function LoginPage() {
  return (
    <div className="flex w-full min-h-screen">
      {/* Left side — topo illustration */}
      <div
        className="hidden md:flex md:flex-col md:justify-between relative overflow-hidden"
        style={{
          width: "58%",
          backgroundColor: "var(--color-bg)",
          borderRight: "1px solid var(--color-line)",
          padding: "48px",
        }}
      >
        <style>{`
          @keyframes topo-flow {
            from { stroke-dashoffset: 0; }
            to   { stroke-dashoffset: -48; }
          }
          .topo-runners { animation: topo-flow 3.5s linear infinite; }
          @media (prefers-reduced-motion: reduce) { .topo-runners { animation: none; } }
        `}</style>

        {/* Full-panel topo illustration */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 580 900"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden="true"
        >
          <defs>
            <filter id="tg" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
            <radialGradient id="pa" cx="420" cy="205" r="260" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--color-lime)" stopOpacity="0.07" />
              <stop offset="100%" stopColor="var(--color-lime)" stopOpacity="0" />
            </radialGradient>
            <radialGradient id="pb" cx="192" cy="428" r="180" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="var(--color-lime)" stopOpacity="0.04" />
              <stop offset="100%" stopColor="var(--color-lime)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="bv" x1="0" y1="0" x2="0" y2="1">
              <stop offset="42%" stopColor="var(--color-bg)" stopOpacity="0" />
              <stop offset="100%" stopColor="var(--color-bg)" stopOpacity="0.94" />
            </linearGradient>
          </defs>

          {/* Peak atmosphere */}
          <ellipse cx="420" cy="205" rx="260" ry="240" fill="url(#pa)" />
          <ellipse cx="192" cy="428" rx="180" ry="155" fill="url(#pb)" />

          {/* Coordinate grid */}
          {[150, 300, 450, 600, 750].map((y) => (
            <line key={`gy${y}`} x1="0" y1={y} x2="580" y2={y}
              stroke="var(--color-ink-4)" strokeWidth="0.4" opacity="0.07" />
          ))}
          {[116, 232, 348, 464].map((x) => (
            <line key={`gx${x}`} x1={x} y1="0" x2={x} y2="900"
              stroke="var(--color-ink-4)" strokeWidth="0.4" opacity="0.07" />
          ))}

          {/* Main peak topo contours */}
          {([
            ["M 275 65 C 338 32 440 44 492 104 C 548 168 552 265 521 328 C 491 392 434 430 376 430 C 318 430 267 402 244 357 C 216 305 215 246 222 198 C 229 152 228 116 246 88 C 260 66 263 83 275 65 Z", 0.10, 0.8],
            ["M 328 102 C 374 75 450 88 482 140 C 518 196 511 270 474 308 C 438 346 387 352 350 326 C 310 298 294 252 298 212 C 302 172 303 146 317 122 C 325 107 325 114 328 102 Z", 0.16, 0.9],
            ["M 363 136 C 394 115 452 126 474 163 C 498 203 480 260 447 274 C 414 288 373 274 358 242 C 342 210 346 178 355 156 C 362 140 356 148 363 136 Z", 0.24, 1.0],
            ["M 388 163 C 412 150 448 158 458 186 C 468 216 450 248 422 250 C 393 253 372 233 372 204 C 372 180 376 170 388 163 Z", 0.32, 1.1],
            ["M 406 186 C 420 178 438 182 440 200 C 442 218 428 228 414 224 C 400 220 395 204 406 186 Z", 0.40, 1.2],
          ] as [string, number, number][]).map(([d, op, sw], i) => (
            <path key={`mp${i}`} d={d} fill="none"
              stroke="var(--color-ink-4)" strokeWidth={sw} opacity={op} />
          ))}

          {/* Secondary peak contours */}
          {([
            ["M 125 345 C 162 322 220 332 250 376 C 280 420 268 476 230 502 C 192 528 146 520 118 484 C 88 446 93 396 103 368 C 113 344 110 362 125 345 Z", 0.12, 0.8],
            ["M 155 380 C 180 365 222 374 238 406 C 254 438 238 476 207 480 C 176 484 148 462 146 432 C 144 402 146 392 155 380 Z", 0.20, 1.0],
            ["M 178 406 C 196 396 218 404 220 424 C 222 444 204 458 188 450 C 170 442 168 420 178 406 Z", 0.28, 1.1],
          ] as [string, number, number][]).map(([d, op, sw], i) => (
            <path key={`sp${i}`} d={d} fill="none"
              stroke="var(--color-ink-4)" strokeWidth={sw} opacity={op} />
          ))}

          {/* Small hill top-left */}
          <path d="M 48 148 C 72 128 108 134 118 166 C 128 198 112 228 86 230 C 58 232 40 210 44 182 C 48 158 44 158 48 148 Z"
            fill="none" stroke="var(--color-ink-4)" strokeWidth="0.8" opacity="0.10" />
          <path d="M 65 160 C 84 150 104 156 110 176 C 116 196 100 215 80 213 C 60 211 54 192 61 172 C 66 160 62 165 65 160 Z"
            fill="none" stroke="var(--color-ink-4)" strokeWidth="0.9" opacity="0.16" />

          {/* Elevation labels */}
          <text x="250" y="296" fontSize="7.5" fill="var(--color-ink-4)" opacity="0.32"
            fontFamily="monospace" transform="rotate(-14,250,296)">1840 m</text>
          <text x="342" y="108" fontSize="7.5" fill="var(--color-ink-4)" opacity="0.32"
            fontFamily="monospace" transform="rotate(-8,342,108)">2095 m</text>
          <text x="108" y="375" fontSize="7.5" fill="var(--color-ink-4)" opacity="0.32"
            fontFamily="monospace" transform="rotate(4,108,375)">1620 m</text>
          <text x="418" y="148" fontSize="8" fill="var(--color-lime)" opacity="0.55"
            fontFamily="monospace" fontWeight="600">▲ 2418 m</text>

          {/* Risk zones */}
          <circle cx="95" cy="700" r="28" fill="var(--color-danger)" opacity="0.06" />
          <circle cx="95" cy="700" r="15" fill="var(--color-danger)" opacity="0.09" />
          <circle cx="296" cy="338" r="22" fill="var(--color-warning)" opacity="0.07" />
          <circle cx="296" cy="338" r="11" fill="var(--color-warning)" opacity="0.10" />

          {/* Trail glow */}
          <path d={TRAIL_D} fill="none" stroke="var(--color-lime)"
            strokeWidth="10" strokeLinecap="round" opacity="0.15" filter="url(#tg)" />

          {/* Trail main line */}
          <path d={TRAIL_D} fill="none" stroke="var(--color-lime)"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.78" />

          {/* Animated runner dots */}
          <path className="topo-runners" d={TRAIL_D} fill="none"
            stroke="var(--color-lime)" strokeWidth="3" strokeLinecap="round"
            strokeDasharray="4 44" opacity="0.55" />

          {/* Waypoints */}
          {([
            [52, 860, false],
            [95, 700, false],
            [191, 421, false],
            [296, 338, false],
            [417, 192, true],
            [492, 393, false],
          ] as [number, number, boolean][]).map(([cx, cy, summit], i) => (
            <g key={i}>
              <circle cx={cx} cy={cy} r={summit ? 7 : 5}
                fill="var(--color-bg)" stroke="var(--color-lime)"
                strokeWidth={summit ? 2 : 1.5} opacity="0.9" />
              {summit && <circle cx={cx} cy={cy} r={3} fill="var(--color-lime)" opacity="0.9" />}
            </g>
          ))}

          {/* North arrow */}
          <g transform="translate(540,62)" opacity="0.28">
            <circle cx="0" cy="0" r="14" fill="none" stroke="var(--color-ink-4)" strokeWidth="0.8" />
            <path d="M 0 -10 L 3 2 L 0 0 L -3 2 Z" fill="var(--color-ink-4)" />
            <text x="0" y="8.5" textAnchor="middle" fontSize="7"
              fill="var(--color-ink-4)" fontFamily="monospace">N</text>
          </g>

          {/* Scale bar */}
          <g transform="translate(48,820)" opacity="0.28">
            <line x1="0" y1="0" x2="58" y2="0" stroke="var(--color-ink-4)" strokeWidth="1.5" />
            <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-ink-4)" strokeWidth="1.5" />
            <line x1="58" y1="-4" x2="58" y2="4" stroke="var(--color-ink-4)" strokeWidth="1.5" />
            <text x="29" y="-8" textAnchor="middle" fontSize="7"
              fill="var(--color-ink-4)" fontFamily="monospace">2 km</text>
          </g>

          {/* Bottom vignette for text readability */}
          <rect x="0" y="0" width="580" height="900" fill="url(#bv)" />
        </svg>

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <polyline points="2,16 6,10 9,13 13,5 17,9 20,7"
                stroke="#7CB518" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="2" y1="16" x2="20" y2="16"
                stroke="#2D5016" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-lg tracking-tight" style={{ color: "var(--color-ink)", fontWeight: 400 }}>
            Trail<strong>Sim</strong>
          </span>
        </div>

        {/* Main content */}
        <div className="flex flex-col gap-8 relative z-10">
          <div className="flex flex-col gap-4">
            <h2
              className="text-4xl font-semibold leading-tight tracking-tight"
              style={{ color: "var(--color-ink)" }}
            >
              Anticipez les{" "}
              <span style={{ color: "var(--color-lime)" }}>risques</span>,<br />
              organisez{" "}
              <span style={{ color: "var(--color-ink)" }}>votre événement</span>
              <br />
              avec précision
            </h2>
            <p className="text-base leading-relaxed max-w-md" style={{ color: "var(--color-ink-3)" }}>
              Simulation jusqu'à 300 runs, carte interactive, gestion des effectifs.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="flex flex-col gap-3">
            {[
              { icon: BarChart2, label: "Simulation — jusqu'à 300 runs" },
              { icon: MapPin,    label: "Carte interactive & placement terrain" },
              { icon: Users,     label: "Gestion des effectifs et bénévoles" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-lime) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-lime) 20%, transparent)",
                  }}
                >
                  <Icon size={14} style={{ color: "var(--color-lime)" }} />
                </div>
                <span className="text-sm" style={{ color: "var(--color-ink-2)" }}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom badge */}
        <div
          className="flex items-center gap-2.5 px-3 py-2 rounded-lg w-fit relative z-10"
          style={{
            backgroundColor: "var(--color-bg-1)",
            border: "1px solid var(--color-line)",
          }}
        >
          <span className="relative flex h-2 w-2">
            <span
              className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75"
              style={{ backgroundColor: "var(--color-safe)" }}
            />
            <span
              className="relative inline-flex rounded-full h-2 w-2"
              style={{ backgroundColor: "var(--color-safe)" }}
            />
          </span>
          <span className="text-xs" style={{ color: "var(--color-ink-3)" }}>
            Simulation en cours —{" "}
            <span style={{ color: "var(--color-ink-2)" }}>Trail des Aiguilles</span>
          </span>
        </div>
      </div>

      {/* Right side — form */}
      <div
        className="flex flex-col items-center justify-center flex-1 px-6 py-12"
        style={{ backgroundColor: "var(--color-bg-1)", minWidth: 0 }}
      >
        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 md:hidden">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            <svg width="20" height="20" viewBox="0 0 22 22" fill="none">
              <polyline points="2,16 6,10 9,13 13,5 17,9 20,7"
                stroke="#7CB518" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="2" y1="16" x2="20" y2="16"
                stroke="#2D5016" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-lg tracking-tight" style={{ color: "var(--color-ink)" }}>
            Trail<strong>Sim</strong>
          </span>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
