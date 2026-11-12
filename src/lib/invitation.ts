import { randomBytes } from 'node:crypto'

import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminUser, ROLE_OPTIONS } from '@/access'

import { getEmailSettings } from '@/emails/settings'
import { invitationMail } from '@/emails/transactional'
import { env } from '@/env'
import type { Locale } from '@/i18n/routing'
import { createPerson } from '@/lib/create-person'
import { isEmail } from '@/lib/password-reset'
import { wait } from '@/lib/resend'
import type { User } from '@/payload-types'

/** How long a set-password link from an invitation works. A reset link keeps Payload's hour. */
export const INVITATION_DAYS = 7

const DAY = 86_400_000

/**
 * A link to /<locale>/welcome/<token>, where a new account sets its password.
 * The token is Payload's reset token, made without Payload's email and with a
 * longer life: `users` sets no expiration of its own, so this one applies.
 */
export const setPasswordLink = async (req: PayloadRequest, email: string, locale: Locale) => {
  const token = await req.payload.forgotPassword({
    collection: 'users',
    data: { email },
    disableEmail: true,
    expiration: INVITATION_DAYS * DAY,
    req,
  })
  if (!token) throw new Error(`No account has the address ${email}.`)
  return `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/${locale}/welcome/${token}`
}

/**
 * A new account and its hidden person. It gets a password nobody knows: the
 * person sets their own from the link in their email, or signs in with Google.
 */
export const createAccount = async (
  req: PayloadRequest,
  data: { email: string; name: string; roles: User['roles'] },
) => {
  const person = await createPerson(req, data.name)
  const user = await req.payload.create({
    collection: 'users',
    data: {
      email: data.email,
      password: randomBytes(24).toString('base64url'),
      roles: data.roles,
      person,
    },
    overrideAccess: true,
    depth: 0,
    req,
  })
  return { user: user.id, person }
}

/** The invitation email, with a fresh set-password link. */
export const sendInvitation = async (
  req: PayloadRequest,
  to: { email: string; name: string },
  locale: Locale,
) => {
  const settings = await getEmailSettings(req.payload, req, locale)
  const mail = await invitationMail(settings, {
    ...to,
    url: await setPasswordLink(req, to.email, locale),
    days: INVITATION_DAYS,
    locale,
  })
  await req.payload.sendEmail({ to: to.email, ...mail })
  await markInvited(req, to.email)
}

/** Records that a set-password link went out, for the Users list's "Invited on". */
export const markInvited = (req: PayloadRequest, email: string) =>
  req.payload.update({
    collection: 'users',
    where: { email: { equals: email } },
    data: { invited_at: new Date().toISOString() },
    overrideAccess: true,
    depth: 0,
    req,
  })

/** At most this many accounts in one request; the Users list sends a larger selection in parts. */
export const INVITE_BATCH = 25

/** Resend's rate is 2 requests a second. */
const SEND_GAP_MS = 600

type BatchResult = {
  sent: number[]
  /** Admins, and accounts invited within the link's life, unless `again`. */
  skipped: number[]
  failed: number[]
  /** Resend refused for its limit: nothing after this was tried. */
  limited: number[]
}

/**
 * Invites the accounts in `ids`, one at a time, in one language. It stops
 * when Resend answers 429 (the free plan's 100 emails a day, or its rate),
 * and lists the accounts not tried, so the admin can send them later.
 */
export const inviteMany = async (
  req: PayloadRequest,
  ids: number[],
  locale: Locale,
  again: boolean,
): Promise<BatchResult> => {
  const result: BatchResult = { sent: [], skipped: [], failed: [], limited: [] }
  const { docs } = await req.payload.find({
    collection: 'users',
    where: { id: { in: ids } },
    depth: 1,
    limit: ids.length,
    overrideAccess: true,
    req,
  })
  const recent = Date.now() - INVITATION_DAYS * DAY
  for (const [i, user] of docs.entries()) {
    const invited = user.invited_at ? Date.parse(user.invited_at) : 0
    if (isAdminUser(user) || (!again && invited > recent)) {
      result.skipped.push(user.id)
      continue
    }
    const person = typeof user.person === 'object' ? user.person : null
    try {
      await sendInvitation(req, { email: user.email, name: person?.name || user.email }, locale)
      result.sent.push(user.id)
    } catch (error) {
      if ((error as { status?: number }).status === 429) {
        result.limited.push(...docs.slice(i).map((u) => u.id))
        break
      }
      req.payload.logger.error({ err: error, msg: `Invitation to user ${user.id} failed` })
      result.failed.push(user.id)
    }
    await wait(SEND_GAP_MS)
  }
  return result
}

type InviteBody = { email?: string; name?: string; roles?: string[]; locale?: string }

const ROLES = new Set<string>(ROLE_OPTIONS.map((o) => o.value))
const localeOf = (value: unknown): Locale => (value === 'ar' ? 'ar' : 'en')

/**
 * Admin → Users: `POST /api/users/invite` makes an account and sends its
 * invitation; `POST /api/users/:id/invite` sends a new link to an account.
 * Admins only. A failed email does not undo the account: the answer says so,
 * and the account page sends a new link.
 */
export const invitationEndpoints: Endpoint[] = [
  {
    path: '/invite',
    method: 'post',
    handler: async (req) => {
      if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as InviteBody
      const email = body.email?.trim().toLowerCase() ?? ''
      const name = body.name?.trim() ?? ''
      const roles = (body.roles ?? []).filter((r) => ROLES.has(r)) as User['roles']
      if (!isEmail(email)) return Response.json({ error: 'email' }, { status: 400 })
      if (!name) return Response.json({ error: 'name' }, { status: 400 })
      if (!roles.length) return Response.json({ error: 'roles' }, { status: 400 })
      const { totalDocs } = await req.payload.count({
        collection: 'users',
        where: { email: { equals: email } },
        overrideAccess: true,
      })
      if (totalDocs) return Response.json({ error: 'exists' }, { status: 409 })

      const { user } = await createAccount(req, { email, name, roles })
      try {
        await sendInvitation(req, { email, name }, localeOf(body.locale))
        return Response.json({ id: user, emailed: true })
      } catch (error) {
        req.payload.logger.error({ err: error, msg: `Invitation to user ${user} failed` })
        return Response.json({ id: user, emailed: false })
      }
    },
  },
  {
    path: '/invite-many',
    method: 'post',
    handler: async (req) => {
      if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as InviteBody & {
        ids?: unknown
        again?: boolean
      }
      const ids = Array.isArray(body.ids) ? body.ids.filter(Number.isInteger) : []
      if (!ids.length || ids.length > INVITE_BATCH)
        return Response.json({ error: `Send 1 to ${INVITE_BATCH} accounts.` }, { status: 400 })
      return Response.json(
        await inviteMany(req, ids as number[], localeOf(body.locale), body.again === true),
      )
    },
  },
  {
    path: '/:id/invite',
    method: 'post',
    handler: async (req) => {
      if (!isAdminUser(req.user)) return Response.json({ error: 'Admins only.' }, { status: 403 })
      const body = ((await req.json?.().catch(() => null)) ?? {}) as InviteBody
      const user = await req.payload
        .findByID({
          collection: 'users',
          id: Number(req.routeParams?.id),
          depth: 1,
          overrideAccess: true,
        })
        .catch(() => null)
      if (!user) return Response.json({ error: 'No such account.' }, { status: 404 })
      const person = typeof user.person === 'object' ? user.person : null
      try {
        await sendInvitation(
          req,
          { email: user.email, name: person?.name || user.email },
          localeOf(body.locale),
        )
        return Response.json({ sent: user.email })
      } catch (error) {
        req.payload.logger.error({ err: error, msg: `Invitation to user ${user.id} failed` })
        return Response.json({ error: 'The email did not go out.' }, { status: 502 })
      }
    },
  },
]
