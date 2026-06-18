import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { z } from "zod"

const ProfileSchema = z.object({
  name: z.string().min(1, "Nom requis").max(120),
})

// Update the signed-in user's own profile (display name).
export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }
    const body = await request.json()
    const parsed = ProfileSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const updated = await db.user.update({
      where: { id: session.user.id },
      data: { name: parsed.data.name.trim() },
      select: { id: true, name: true },
    })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH /api/me]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
