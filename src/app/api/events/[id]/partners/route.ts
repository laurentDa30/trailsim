import { auth } from "@/lib/auth"
import db from "@/lib/db"
import { getEventAccess, canManage, canRead } from "@/lib/authz"
import { PARTNER_KIND_VALUES, PARTNER_STATUS_VALUES, PARTNER_CONTRIBUTION_VALUES } from "@/lib/partners"
import { z } from "zod"

const PartnerCreateSchema = z.object({
  name: z.string().min(1).max(160),
  kind: z.enum(PARTNER_KIND_VALUES).default("SPONSOR"),
  status: z.enum(PARTNER_STATUS_VALUES).default("A_CONTACTER"),
  contactName: z.string().max(120).nullable().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  note: z.string().max(500).nullable().optional(),
  contributions: z.array(z.enum(PARTNER_CONTRIBUTION_VALUES)).optional(),
  amount: z.number().nonnegative().nullable().optional(),
  responsibleId: z.string().nullable().optional(),
  nextContactDate: z.string().datetime().nullable().optional(),
  wish: z.string().max(500).nullable().optional(),
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
    const d = parsed.data
    const partner = await db.partner.create({
      data: {
        eventId: id,
        name: d.name,
        kind: d.kind,
        status: d.status,
        contactName: d.contactName ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
        note: d.note ?? null,
        contributions: JSON.stringify(d.contributions ?? []),
        amount: d.amount ?? null,
        responsibleId: d.responsibleId ?? null,
        nextContactDate: d.nextContactDate ? new Date(d.nextContactDate) : null,
        wish: d.wish ?? null,
      },
    })
    return Response.json(partner, { status: 201 })
  } catch (error) {
    console.error("[POST partners]", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
