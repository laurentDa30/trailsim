import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const SectionCreateSchema = z.object({
  name: z.string().min(1).max(120),
  color: z.string().max(20).optional(),
  responsibleId: z.string().nullable().optional(),
})

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!canRead(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const sections = await db.section.findMany({
      where: { eventId: id },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    })
    return Response.json(sections)
  } catch (error) {
    console.error("[GET sections]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id } = await params
    if (!canManage(await getEventAccess(session.user.id, id))) {
      return Response.json({ error: "Forbidden" }, { status: 403 })
    }
    const parsed = SectionCreateSchema.safeParse(await request.json())
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const count = await db.section.count({ where: { eventId: id } })
    const section = await db.section.create({
      data: {
        eventId: id,
        name: parsed.data.name,
        color: parsed.data.color ?? "#7CB518",
        responsibleId: parsed.data.responsibleId ?? null,
        order: count,
      },
    })
    return Response.json(section, { status: 201 })
  } catch (error) {
    console.error("[POST sections]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
