import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const MemberCreateSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  role: z.enum(["ORGANISATEUR", "BENEVOLE"]).default("BENEVOLE"),
  note: z.string().max(500).nullable().optional(),
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
    const members = await db.eventMember.findMany({
      where: { eventId: id },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    })
    return Response.json(members)
  } catch (error) {
    console.error("[GET members]", error)
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
    const parsed = MemberCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const member = await db.eventMember.create({
      data: {
        eventId: id,
        name: parsed.data.name,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        role: parsed.data.role,
        note: parsed.data.note ?? null,
      },
    })
    return Response.json(member, { status: 201 })
  } catch (error) {
    console.error("[POST members]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
