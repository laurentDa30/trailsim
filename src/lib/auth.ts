import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import db from "./db"

/**
 * Passwordless sign-in for a bureau member via their personal access token
 * (EventMember.inviteToken). Only ORGANISATEUR members escalate to a real
 * session — bénévoles keep the read-only /b/ token view. Creates/binds a
 * passwordless User the first time and marks the membership ACTIF.
 */
async function authorizeMagicToken(token: string) {
  const member = await db.eventMember.findUnique({
    where: { inviteToken: token },
  })
  if (!member || member.role !== "ORGANISATEUR") return null

  // Already linked to an account → sign in as that user.
  if (member.userId) {
    const u = await db.user.findUnique({ where: { id: member.userId } })
    return u ? { id: u.id, email: u.email, name: u.name ?? undefined } : null
  }

  // Link to an existing account with the same email, else create a passwordless one.
  let user = member.email
    ? await db.user.findUnique({ where: { email: member.email } })
    : null
  if (!user) {
    user = await db.user.create({
      data: {
        email: member.email ?? `bureau-${member.id}@trailsim.local`,
        name: member.name,
        passwordHash: null,
      },
    })
  }
  await db.eventMember.update({
    where: { id: member.id },
    data: { userId: user.id, status: "ACTIF" },
  })
  return { id: user.id, email: user.email, name: user.name ?? undefined }
}

export const { auth, signIn, signOut, handlers } = NextAuth({
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        token: { label: "Token", type: "text" },
      },
      async authorize(credentials) {
        // Magic-link path: a one-time access token, no password.
        const token = credentials?.token
        if (typeof token === "string" && token.length > 0) {
          return authorizeMagicToken(token)
        }

        const email = credentials?.email
        const password = credentials?.password

        if (typeof email !== "string" || typeof password !== "string") {
          return null
        }

        const user = await db.user.findUnique({
          where: { email },
        })

        if (!user || !user.passwordHash) return null

        const isValid = await bcrypt.compare(password, user.passwordHash)
        if (!isValid) return null

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        if (user.name) token.name = user.name
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        if (token.id) session.user.id = token.id as string
        if (token.name) session.user.name = token.name as string
      }
      return session
    },
  },
})
