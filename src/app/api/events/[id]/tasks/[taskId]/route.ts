import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"

const TaskPatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z
    .enum(["ADMINISTRATIF", "SECURITE", "LOGISTIQUE", "COMMUNICATION", "GENERAL"])
    .optional(),
  dueDate: z.string().datetime().nullable().optional(),
  done: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
})

async function authorize(sessionUserId: string, eventId: string, taskId: string) {
  if (!canManage(await getEventAccess(sessionUserId, eventId))) {
    return { ok: false as const, status: 403, error: "Forbidden" }
  }
  const task = await db.task.findUnique({ where: { id: taskId } })
  if (!task || task.eventId !== eventId) {
    return { ok: false as const, status: 404, error: "Task not found" }
  }
  return { ok: true as const }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId } = await params
    const authz = await authorize(session.user.id, id, taskId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    const body = await request.json()
    const parsed = TaskPatchSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const { dueDate, done, ...rest } = parsed.data
    const updated = await db.task.update({
      where: { id: taskId },
      data: {
        ...rest,
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(done !== undefined ? { done, doneAt: done ? new Date() : null } : {}),
      },
    })
    return Response.json(updated)
  } catch (error) {
    console.error("[PATCH task]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) return Response.json({ error: "Unauthorized" }, { status: 401 })
    const { id, taskId } = await params
    const authz = await authorize(session.user.id, id, taskId)
    if (!authz.ok) return Response.json({ error: authz.error }, { status: authz.status })

    await db.task.delete({ where: { id: taskId } })
    return new Response(null, { status: 204 })
  } catch (error) {
    console.error("[DELETE task]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
