// Access control for the /admin console. There is no `role` column on User, so
// admin access is granted by email allow-list. This is a plain constant (no env)
// so it works in both server and client components — add emails here as needed.
export const ADMIN_EMAILS = ["laurent3022@gmail.com"]

/** True when the given email is allowed into the admin console. */
export function isAdminEmail(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email.toLowerCase())
}
