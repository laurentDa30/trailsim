export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      className="flex flex-col flex-1 min-h-screen"
      style={{ backgroundColor: "var(--color-bg)" }}
    >
      {children}
    </div>
  )
}
