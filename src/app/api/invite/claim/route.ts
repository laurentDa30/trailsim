import db from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const ClaimSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8).max(200),
})

/** Generic login identifier when the organiser was added without an email. */
function genericEmail(memberId: string): string {
  return `org-${memberId}@trailsim.local`
}

/**
 * Onboard a bureau ORGANISATEUR from their access link: they set ONLY a
 * password. The login identifier is the email recorded when they were added,
 * or a generic one if none. A real account is created/linked and bound to the
 * EventMember (ACTIF). They reconnect later via the same link + their password.
 */
export async function POST(request: Request) {
  try {
    const parsed = ClaimSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const { token, password } = parsed.data

    const member = await db.eventMember.findUnique({ where: { inviteToken: token } })
    if (!member || member.role !== "ORGANISATEUR") {
      return Response.json({ error: "Lien invalide" }, { status: 404 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    // Already linked to an account → set/refresh password (legacy passwordless)
    // and reuse its email.
    if (member.userId) {
      const u = await db.user.findUnique({ where: { id: member.userId } })
      if (u) {
        if (u.passwordHash) return Response.json({ status: "already", email: u.email })
        await db.user.update({ where: { id: u.id }, data: { passwordHash } })
        await db.eventMember.update({ where: { id: member.id }, data: { status: "ACTIF" } })
        return Response.json({ status: "created", email: u.email })
      }
    }

    const email = member.email?.trim() || genericEmail(member.id)
    const existing = await db.user.findUnique({ where: { email } })

    if (existing?.passwordHash) {
      // The recorded email already has an account — link the membership but keep
      // that account's own password (they sign in with it).
      try {
        await db.eventMember.update({
          where: { id: member.id },
          data: { userId: existing.id, status: "ACTIF" },
        })
      } catch {
        /* already a member of this event — access stands */
      }
      return Response.json({ status: "linked", email })
    }

    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { passwordHash } })
      : await db.user.create({ data: { email, name: member.name, passwordHash } })
    await db.eventMember.update({
      where: { id: member.id },
      data: { userId: user.id, status: "ACTIF" },
    })
    return Response.json({ status: "created", email })
  } catch (error) {
    console.error("[POST /api/invite/claim]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
