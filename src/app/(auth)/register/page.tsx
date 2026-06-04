import { RegisterForm } from "./register-form"

export default function RegisterPage() {
  return (
    <div
      className="flex flex-col items-center justify-center w-full min-h-screen px-6 py-12"
      style={{ backgroundColor: "var(--color-bg-1)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 mb-10">
        <div
          className="flex items-center justify-center w-9 h-9 rounded-lg"
          style={{ backgroundColor: "#0d1a00" }}
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

      <RegisterForm />
    </div>
  )
}
