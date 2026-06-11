// Central event access control. Until now every route compared
// event.userId !== session.user.id (owner-only); with EventMember an event can
// have co-organisers and volunteers, so all checks go through here instead.

import db from '@/lib/db'

export type EventRole = 'OWNER' | 'ORGANISATEUR' | 'BENEVOLE'

export interface EventAccess {
  role: EventRole
  eventId: string
}

/**
 * Role of `userId` on `eventId`, or null when the user has no access.
 * Owner of the event → OWNER; otherwise the claimed membership's role.
 */
export async function getEventAccess(
  userId: string,
  eventId: string
): Promise<EventAccess | null> {
  const event = await db.event.findUnique({
    where: { id: eventId },
    select: { userId: true },
  })
  if (!event) return null
  if (event.userId === userId) return { role: 'OWNER', eventId }
  const member = await db.eventMember.findFirst({
    where: { eventId, userId, status: 'ACTIF' },
    select: { role: true },
  })
  if (!member) return null
  const role: EventRole = member.role === 'ORGANISATEUR' ? 'ORGANISATEUR' : 'BENEVOLE'
  return { role, eventId }
}

/** Roles allowed to modify the event (config, courses, simulations, équipe). */
export function canManage(access: EventAccess | null): boolean {
  return access != null && (access.role === 'OWNER' || access.role === 'ORGANISATEUR')
}

/** Any attached role can read the event (pages, results, report). */
export function canRead(access: EventAccess | null): boolean {
  return access != null
}
