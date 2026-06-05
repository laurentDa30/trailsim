import { BarChart2, Map, Users } from "lucide-react"
import { LoginForm } from "./login-form"

export default function LoginPage() {
  return (
    <div className="flex w-full min-h-screen">
      {/* Left side — decorative, hidden on mobile */}
      <div
        className="hidden md:flex md:flex-col md:justify-between relative overflow-hidden"
        style={{
          width: "58%",
          backgroundColor: "var(--color-bg)",
          borderRight: "1px solid var(--color-line)",
          padding: "48px",
        }}
      >
        {/* Background texture */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 30% 70%, color-mix(in srgb, var(--color-lime) 4%, transparent) 0%, transparent 60%)",
          }}
        />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            {/* SVG altimetry profile icon */}
            <svg
              width="22"
              height="22"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polyline
                points="2,16 6,10 9,13 13,5 17,9 20,7"
                stroke="#7CB518"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <line
                x1="2"
                y1="16"
                x2="20"
                y2="16"
                stroke="#2D5016"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            className="text-lg tracking-tight"
            style={{ color: "var(--color-ink)", fontWeight: 400 }}
          >
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
              <span style={{ color: "var(--color-lime)" }}>risques</span>,
              <br />
              organisez avec précision
            </h2>
            <p
              className="text-base leading-relaxed max-w-md"
              style={{ color: "var(--color-ink-3)" }}
            >
              Simulez votre peloton, détectez les bouchons, optimisez votre
              logistique terrain.
            </p>
          </div>

          {/* Feature bullets */}
          <div className="flex flex-col gap-3">
            {[
              {
                icon: BarChart2,
                label: "Simulation Monte-Carlo 100 runs",
              },
              {
                icon: Map,
                label: "Carte interactive Leaflet",
              },
              {
                icon: Users,
                label: "Gestion du peloton",
              },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
                  style={{
                    backgroundColor: "color-mix(in srgb, var(--color-lime) 12%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-lime) 20%, transparent)",
                  }}
                >
                  <Icon
                    size={14}
                    style={{ color: "var(--color-lime)" }}
                  />
                </div>
                <span
                  className="text-sm"
                  style={{ color: "var(--color-ink-2)" }}
                >
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
          {/* Pulsing green dot */}
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
          <span
            className="text-xs"
            style={{ color: "var(--color-ink-3)" }}
          >
            Simulation en cours —{" "}
            <span style={{ color: "var(--color-ink-2)" }}>
              Trail des Aiguilles
            </span>
          </span>
        </div>
      </div>

      {/* Right side — form */}
      <div
        className="flex flex-col items-center justify-center flex-1 px-6 py-12"
        style={{
          backgroundColor: "var(--color-bg-1)",
          minWidth: 0,
        }}
      >
        {/* Mobile logo */}
        <div className="flex items-center gap-3 mb-10 md:hidden">
          <div
            className="flex items-center justify-center w-9 h-9 rounded-lg"
            style={{ backgroundColor: "#ffffff" }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 22 22"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <polyline
                points="2,16 6,10 9,13 13,5 17,9 20,7"
                stroke="#7CB518"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
              <line
                x1="2"
                y1="16"
                x2="20"
                y2="16"
                stroke="#2D5016"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            className="text-lg tracking-tight"
            style={{ color: "var(--color-ink)" }}
          >
            Trail<strong>Sim</strong>
          </span>
        </div>

        <LoginForm />
      </div>
    </div>
  )
}
