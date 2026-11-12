import { randomBytes } from 'node:crypto'

import type { Endpoint, PayloadRequest } from 'payload'

import { isAdminUser, ROLE_OPTIONS } from '@/access'

import { getEmailSettings } from '@/emails/settings'
import { invitationMail } from '@/emails/transactional'
import { env } from '@/env'
import type { Locale } from '@/i18n/routing'
import { createPerson } from '@/lib/create-person'
import { isEmail } from '@/lib/password-reset'
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
