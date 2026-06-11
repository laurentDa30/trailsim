import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const TaskCreateSchema = z.object({
  title: z.string().min(1).max(300),
  category: z
    .enum(["ADMINISTRATIF", "SECURITE", "LOGISTIQUE", "COMMUNICATION", "GENERAL"])
    .default("GENERAL"),
  dueDate: z.string().datetime().nullable().optional(),
  parentId: z.string().nullable().optional(),
  note: z.string().max(1000).nullable().optional(),
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
    const tasks = await db.task.findMany({
      where: { eventId: id },
      orderBy: [{ done: "asc" }, { dueDate: "asc" }, { createdAt: "asc" }],
    })
    return Response.json(tasks)
  } catch (error) {
    console.error("[GET tasks]", error)
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
    const body = await request.json()
    const parsed = TaskCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    // A sub-task's parent must belong to the same event (and stay one level deep).
    let parentId: string | null = null
    if (parsed.data.parentId) {
      const parent = await db.task.findUnique({ where: { id: parsed.data.parentId } })
      if (!parent || parent.eventId !== id) {
        return Response.json({ error: "Parent task not found" }, { status: 400 })
      }
      parentId = parent.parentId ?? parent.id
    }

    const task = await db.task.create({
      data: {
        eventId: id,
        title: parsed.data.title,
        category: parsed.data.category,
        dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
        parentId,
        note: parsed.data.note ?? null,
      },
    })
    return Response.json(task, { status: 201 })
  } catch (error) {
    console.error("[POST tasks]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
