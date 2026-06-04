import db from "@/lib/db"
import bcrypt from "bcryptjs"
import { z } from "zod"

const RegisterSchema = z.object({
  name: z.string().optional(),
  email: z.email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const parsed = RegisterSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }

    const { name, email, password } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return Response.json({ error: "Un compte avec cet email existe déjà." }, { status: 409 })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const user = await db.user.create({
      data: {
        name: name ?? null,
        email,
        passwordHash,
      },
    })

    return Response.json({ id: user.id, email: user.email, name: user.name }, { status: 201 })
  } catch (error) {
    console.error("[POST /api/auth/register]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
