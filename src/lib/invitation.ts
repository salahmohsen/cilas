import { randomBytes } from 'node:crypto'

import {
  ValidationError,
  type CollectionAfterChangeHook,
  type CollectionAfterOperationHook,
  type Endpoint,
  type PayloadRequest,
} from 'payload'

import { isAdminUser, ROLE_OPTIONS } from '@/access'

import { getEmailSettings } from '@/emails/settings'
import { invitationMail } from '@/emails/transactional'
import { env } from '@/env'
import type { Locale } from '@/i18n/routing'
import { createPerson } from '@/lib/create-person'
import { actorOf, notify } from '@/lib/notify'
import { isEmail } from '@/lib/password-reset'
import { adminRecipients } from '@/lib/review-mail'
import { wait } from '@/lib/resend'
import type { User } from '@/payload-types'

/** How long a set-password link from an invitation works. A reset link keeps Payload's hour. */
export const INVITATION_DAYS = 7

const DAY = 86_400_000

/** An account to invite: its id, and the address its email goes to. */
export type Invitee = { id: number; email: string }

/**
 * Whether the account has signed in: with a password (`activated_at`, set by
 * `markActivated`) or with Google (`sub`). Such an account needs no invitation.
 */
export const hasSignedIn = (user: Pick<User, 'activated_at' | 'sub'>) =>
  Boolean(user.activated_at || user.sub)

/** Users' afterOperation: the first sign-in, or the first password set from a link. */
export const markActivated: CollectionAfterOperationHook<'users'> = async ({
  operation,
  result,
  req,
}) => {
  if (operation !== 'login' && operation !== 'resetPassword') return result
  const user = (result as { user?: Pick<User, 'id' | 'activated_at'> } | undefined)?.user
  if (user && !user.activated_at) {
    await req.payload
      .update({
        collection: 'users',
        id: user.id,
        data: { activated_at: new Date().toISOString() },
        overrideAccess: true,
        depth: 0,
        req,
      })
      .catch((err) =>
        req.payload.logger.error({ err, msg: `Sign-in of user ${user.id} not recorded` }),
      )
  }
  return result
}

/**
 * Users' afterChange: tells the admins when an invited account signs in for
 * the first time, by password (`activated_at`) or by Google (`sub`). The
 * account itself is not told, even when it is an admin.
 */
export const announceAcceptance: CollectionAfterChangeHook<User> = async ({
  doc,
  previousDoc,
  operation,
  req,
}) => {
  if (operation !== 'update' || !doc.invited_at) return doc
  if (!hasSignedIn(doc) || hasSignedIn(previousDoc)) return doc
  const admins = (await adminRecipients(req)).map((a) => a.id).filter((id) => id !== doc.id)
  const person = typeof doc.person === 'object' ? doc.person?.id : doc.person
  const actor = await actorOf(req.payload, person)
  await notify(req.payload, admins, {
    kind: 'joined',
    description: `${actor?.name || doc.email} accepted the invitation`,
    link: `/admin/collections/users/${doc.id}`,
    actor,
  })
  return doc
}

/**
 * A link to /<locale>/welcome/<token>, where a new account sets its password.
 * The token is Payload's reset token, made without Payload's email and with a
 * longer life: `users` sets no expiration of its own, so this one applies.
 * A new token replaces the account's older one.
 */
export const setPasswordLink = async (req: PayloadRequest, invitee: Invitee, locale: Locale) => {
  const token = await req.payload.forgotPassword({
    collection: 'users',
    data: { email: invitee.email },
    disableEmail: true,
    expiration: INVITATION_DAYS * DAY,
    req,
  })
  if (!token) throw new Error(`User ${invitee.id} has no account to reset.`)
  return `${env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}/${locale}/welcome/${token}`
}

/**
 * Records that a set-password link went out: "Invited on" for the Users list,
 * and a line in the invitation log for the daily count. A failure here is
 * logged, not thrown: the email is out, and a retry would send it twice.
 */
export const recordInvitation = async (req: PayloadRequest, user: number) => {
  try {
    await req.payload.update({
      collection: 'users',
      id: user,
      data: { invited_at: new Date().toISOString() },
      overrideAccess: true,
      depth: 0,
      req,
    })
    await req.payload.create({
      collection: 'invitation-log',
      data: { user },
      overrideAccess: true,
      depth: 0,
      req,
    })
  } catch (err) {
    req.payload.logger.error({ err, msg: `Invitation to user ${user} sent but not recorded` })
  }
}

/** Invitation emails sent since midnight UTC, when Resend's day starts. */
export const invitationsToday = async (req: PayloadRequest) => {
  const midnight = new Date()
  midnight.setUTCHours(0, 0, 0, 0)
  const { totalDocs } = await req.payload.count({
    collection: 'invitation-log',
    where: { createdAt: { greater_than_equal: midnight.toISOString() } },
    overrideAccess: true,
    req,
  })
  return totalDocs
}

/**
 * A new account and its hidden person. It gets a password nobody knows: the
 * person sets their own from the link in their email, or signs in with Google.
 * If the account cannot be made (its address was taken a moment ago), the
 * person is removed again.
 */
export const createAccount = async (
  req: PayloadRequest,
  data: { email: string; name: string; roles: User['roles'] },
) => {
  const person = await createPerson(req, data.name)
  try {
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
  } catch (error) {
    await req.payload.delete({ collection: 'people', id: person, overrideAccess: true, req })
    throw error
  }
}

/** Resend answers 429 for its rate (2 a second) and for its daily limit. */
const isRefused = (error: unknown) => (error as { status?: number }).status === 429

/** Wait before the one retry after a 429: long enough for the rate limit to pass. */
const RETRY_MS = 1500

/**
 * Sends an email, and once more after a 429 that came from the rate limit. A
 * second 429 means the day's limit: it is thrown, with status 429.
 */
const sendOnce = async (
  req: PayloadRequest,
  message: Parameters<PayloadRequest['payload']['sendEmail']>[0],
) => {
  try {
    await req.payload.sendEmail(message)
  } catch (error) {
    if (!isRefused(error)) throw error
    await wait(RETRY_MS)
    await req.payload.sendEmail(message)
  }
}

/**
 * The invitation email, with a fresh set-password link. The new link replaces
 * the older one, so if the send fails the older link no longer works either.
 */
export const sendInvitation = async (
  req: PayloadRequest,
  invitee: Invitee & { name: string },
  locale: Locale,
) => {
  const settings = await getEmailSettings(req.payload, req, locale)
  const mail = await invitationMail(settings, {
    name: invitee.name,
    email: invitee.email,
    url: await setPasswordLink(req, invitee, locale),
    days: INVITATION_DAYS,
  })
  await sendOnce(req, { to: invitee.email, ...mail })
  await recordInvitation(req, invitee.id)
}

/** At most this many accounts in one request (a few seconds of sending); the list sends more in parts. */
export const INVITE_BATCH = 10

/**
 * Bulk invitations a day, counted in the invitation log since midnight UTC,
 * when Resend's day starts. Every invitation email counts, single ones and
 * acceptance emails too. Resend's free plan sends 100 transactional emails a
 * day in all, so this keeps 20 for resets, decisions, reviews and digests.
 * Raise it on a paid plan.
 */
export const BULK_INVITES_PER_DAY = 80

/** Resend's rate is 2 requests a second. */
const SEND_GAP_MS = 600

type BatchResult = {
  sent: number[]
  /** Admins, accounts that have signed in, and accounts invited within the link's life, unless `again`. */
  skipped: number[]
  failed: number[]
  /** Not tried: today's invitations are used up, or Resend refused for its daily limit. */
  limited: number[]
}

/** Who a batch passes over: admins, people who signed in, and recent invitations unless `again`. */
const skips = (user: User, again: boolean) => {
  const recent = Date.now() - INVITATION_DAYS * DAY
  const invited = user.invited_at ? Date.parse(user.invited_at) : 0
  return isAdminUser(user) || hasSignedIn(user) || (!again && invited > recent)
}

/**
 * Invites the accounts in `ids`, one at a time, in one language. It stops at
 * BULK_INVITES_PER_DAY or at Resend's daily limit, and lists the accounts not
 * tried, so the admin can send them later.
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
  let left = BULK_INVITES_PER_DAY - (await invitationsToday(req))
  for (const user of docs) {
    if (skips(user, again)) {
      result.skipped.push(user.id)
      continue
    }
    if (left <= 0) {
      result.limited.push(user.id)
      continue
    }
    const person = typeof user.person === 'object' ? user.person : null
    try {
      await sendInvitation(
        req,
        { id: user.id, email: user.email, name: person?.name || user.email },
        locale,
      )
      result.sent.push(user.id)
      left--
    } catch (error) {
      if (isRefused(error)) {
        left = 0
        result.limited.push(user.id)
        continue
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

      let user: number
      try {
        ;({ user } = await createAccount(req, { email, name, roles }))
      } catch (error) {
        if (error instanceof ValidationError)
          return Response.json({ error: 'exists' }, { status: 409 })
        throw error
      }
      try {
        await sendInvitation(req, { id: user, email, name }, localeOf(body.locale))
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
          { id: user.id, email: user.email, name: person?.name || user.email },
          localeOf(body.locale),
        )
        return Response.json({ sent: user.email })
      } catch (error) {
        req.payload.logger.error({ err: error, msg: `Invitation to user ${user.id} failed` })
        return Response.json(
          { error: isRefused(error) ? 'limit' : 'failed' },
          { status: isRefused(error) ? 429 : 502 },
        )
      }
    },
  },
]
