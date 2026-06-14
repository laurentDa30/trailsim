import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import db from '@/lib/db'
import { MagicLinkSignIn } from './magic-link-signin'

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
 * Bureau access link. The token is the credential: an ORGANISATEUR clicks it and
 * a passwordless management session is opened (account created/bound on first
 * use, membership marked ACTIF — handled in the auth provider). Bénévoles are
 * redirected to their read-only /b/ view.
 */
export default async function InvitePage({ params }: PageProps) {
  const { token } = await params

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

  const session = await auth()

  // Owner or already-signed-in organiser → straight to management.
  if (session?.user?.id && member.event.userId === session.user.id) {
    redirect(`/events/${member.event.id}/setup`)
  }
  if (session?.user?.id && member.userId === session.user.id) {
    redirect(`/events/${member.event.id}/setup`)
  }

  // Volunteers don't get management access — send them to their personal view.
  if (member.role !== 'ORGANISATEUR') {
    redirect(`/b/${token}`)
  }

  // Login mode once an account with a password exists; otherwise set-password.
  const boundUser = member.userId
    ? await db.user.findUnique({ where: { id: member.userId }, select: { email: true, passwordHash: true } })
    : null
  const mode = boundUser?.passwordHash ? 'login' : 'setup'
  const loginEmail = mode === 'login' ? boundUser!.email : member.email
  const emailIsReal = !!member.email

  return (
    <MagicLinkSignIn
      token={token}
      eventName={member.event.name}
      eventId={member.event.id}
      memberName={member.name}
      mode={mode}
      email={loginEmail}
      emailIsReal={emailIsReal}
    />
  )
}
