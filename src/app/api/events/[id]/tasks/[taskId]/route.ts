import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage } from "@/lib/authz"
import { z } from "zod"
import { TASK_CATEGORY_VALUES, TASK_STATUS_VALUES, doneFromStatus } from "@/lib/tasks"

const TaskPatchSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  category: z.enum(TASK_CATEGORY_VALUES).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  done: z.boolean().optional(),
  note: z.string().max(1000).nullable().optional(),
  assigneeId: z.string().nullable().optional(),
  amountEstimated: z.number().nonnegative().nullable().optional(),
  amountActual: z.number().nonnegative().nullable().optional(),
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
    const { startDate, dueDate, done, status, ...rest } = parsed.data
    // Keep `done` in sync with `status` (done = VALIDE). `status` wins when both
    // come in; a legacy `done` toggle maps to VALIDE / EN_ATTENTE.
    let donePatch: { status?: string; done: boolean; doneAt: Date | null } | null = null
    if (status !== undefined) {
      const d = doneFromStatus(status)
      donePatch = { status, done: d, doneAt: d ? new Date() : null }
    } else if (done !== undefined) {
      donePatch = { status: done ? "VALIDE" : "EN_ATTENTE", done, doneAt: done ? new Date() : null }
    }
    const updated = await db.task.update({
      where: { id: taskId },
      data: {
        ...rest,
        ...(startDate !== undefined ? { startDate: startDate ? new Date(startDate) : null } : {}),
        ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
        ...(donePatch ?? {}),
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
