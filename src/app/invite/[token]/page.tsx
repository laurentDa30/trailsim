import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import db from '@/lib/db'

interface PageProps {
  params: Promise<{ token: string }>
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <main
      className="min-h-screen flex items-center justify-center p-6"
      style={{ background: 'var(--color-bg)' }}
    >
      <div
        className="max-w-md w-full rounded-xl p-6 text-center"
        style={{ background: 'var(--color-bg-1)', border: '1px solid var(--color-line)' }}
      >
        <h1 className="text-base font-semibold mb-2" style={{ color: 'var(--color-ink)' }}>
          {title}
        </h1>
        <p className="text-sm mb-4" style={{ color: 'var(--color-ink-3)' }}>
          {body}
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-4 py-2 rounded-md text-sm font-medium"
          style={{
            background: 'color-mix(in oklab, var(--color-lime) 18%, transparent)',
            color: 'var(--color-lime)',
            border: '1px solid color-mix(in oklab, var(--color-lime) 35%, transparent)',
          }}
        >
          Aller au dashboard
        </Link>
      </div>
    </main>
  )
}

/**
 * Claim an invite link: binds the logged-in account to the EventMember record
 * and activates it. The middleware already forces login (with callbackUrl back
 * here), so an invited volunteer without an account registers first, then lands
 * back on this page.
 */
export default async function InvitePage({ params }: PageProps) {
  const { token } = await params

  const session = await auth()
  if (!session?.user?.id) redirect(`/login?callbackUrl=/invite/${token}`)

  const member = await db.eventMember.findUnique({
    where: { inviteToken: token },
    include: { event: { select: { id: true, name: true, userId: true } } },
  })

  if (!member) {
    return (
      <Notice
        title="Invitation introuvable"
        body="Ce lien d'invitation n'existe pas ou a été supprimé par l'organisateur."
      />
    )
  }

  // The owner doesn't need a membership.
  if (member.event.userId === session.user.id) {
    redirect(`/events/${member.event.id}/setup`)
  }

  if (member.userId && member.userId !== session.user.id) {
    return (
      <Notice
        title="Invitation déjà utilisée"
        body="Ce lien a déjà été réclamé par un autre compte. Demandez un nouveau lien à l'organisateur."
      />
    )
  }

  if (member.userId !== session.user.id) {
    // A user can hold only one membership per event (@@unique). If they already
    // have one (e.g. invited twice), keep the existing membership as-is.
    const existing = await db.eventMember.findFirst({
      where: { eventId: member.eventId, userId: session.user.id },
    })
    if (!existing) {
      await db.eventMember.update({
        where: { id: member.id },
        data: { userId: session.user.id, status: 'ACTIF' },
      })
    }
  }

  redirect(`/events/${member.event.id}/equipe`)
}
