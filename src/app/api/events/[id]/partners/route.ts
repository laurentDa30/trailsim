import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { z } from "zod"

const PartnerCreateSchema = z.object({
  name: z.string().min(1).max(160),
  kind: z.enum(["SPONSOR", "INSTITUTION", "SECOURS", "PRESSE", "AUTRE"]).default("SPONSOR"),
  contactName: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
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
    const partners = await db.partner.findMany({
      where: { eventId: id },
      orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
    })
    return Response.json(partners)
  } catch (error) {
    console.error("[GET partners]", error)
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
    const parsed = PartnerCreateSchema.safeParse(body)
    if (!parsed.success) {
      return Response.json({ error: "Validation error", issues: parsed.error.issues }, { status: 400 })
    }
    const partner = await db.partner.create({
      data: {
        eventId: id,
        name: parsed.data.name,
        kind: parsed.data.kind,
        contactName: parsed.data.contactName ?? null,
        email: parsed.data.email ?? null,
        phone: parsed.data.phone ?? null,
        note: parsed.data.note ?? null,
      },
    })
    return Response.json(partner, { status: 201 })
  } catch (error) {
    console.error("[POST partners]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
