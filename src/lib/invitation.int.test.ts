import { http, HttpResponse } from 'msw'
import { createLocalReq, getPayload, ValidationError, type Payload } from 'payload'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import {
  announceAcceptance,
  BULK_INVITES_PER_DAY,
  createAccount,
  hasSignedIn,
  INVITATION_DAYS,
  invitationEndpoints,
  invitationsToday,
  inviteMany,
  setPasswordLink,
} from '@/lib/invitation'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, holdInvitationBudget, uniq, uniqEmail } from '../../testing/payload.fixture'

const [create, many, resend] = invitationEndpoints

const EMAILS = 'https://api.resend.com/emails'
const sent = (id: string) => HttpResponse.json({ id })
const refused = () =>
  HttpResponse.json(
    { statusCode: 429, name: 'rate_limit_exceeded', message: 'Slow down' },
    { status: 429 },
  )

const network = mockNetwork(...localServices)

let payload: Payload
const { track, cleanup } = createTracker()
const accountIds: number[] = []
const noteLinks: string[] = []

const account = async (
  name: string,
  extra: Partial<Pick<User, 'roles' | 'invited_at' | 'activated_at' | 'sub'>> = {},
) => {
  const slug = uniq(name.toLowerCase().replace(/\W+/g, '-'))
  const person = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name, slug, visible: false },
      overrideAccess: true,
    }),
  ).id
  const password = crypto.randomUUID()
  const user = track(
    'users',
    (await payload.create({
      collection: 'users',
      data: { email: uniqEmail(slug), password, roles: ['member'], person, ...extra },
      overrideAccess: true,
    })) as unknown as User,
  )
  accountIds.push(user.id)
  return { user, person, password }
}

const requestOf = async (
  body: Record<string, unknown>,
  user: User,
  routeParams: Record<string, string> = {},
) =>
  Object.assign(await createLocalReq({ user: { ...user, collection: 'users' } }, payload), {
    json: async () => body,
    routeParams,
  })

const keepCreated = async (email: string) => {
  const { docs } = await payload.find({
    collection: 'users',
    where: { email: { equals: email } },
    overrideAccess: true,
    depth: 0,
  })
  for (const doc of docs) {
    track('users', doc as unknown as User)
    accountIds.push(doc.id)
  }
  return docs[0] as unknown as User | undefined
}

const valid = (email: string, over: Record<string, unknown> = {}) => ({
  email: ` ${email.toUpperCase()} `,
  name: 'Mona Adel',
  roles: ['member'],
  locale: 'ar',
  ...over,
})

let admin: User

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  admin = (await account('Invitation admin', { roles: ['admin'] })).user
})

const clearLog = () =>
  payload.delete({
    collection: 'invitation-log',
    where: { user: { in: accountIds } },
    overrideAccess: true,
  })

afterAll(async () => {
  await payload.delete({
    collection: 'notifications',
    where: { link: { in: noteLinks } },
    overrideAccess: true,
  })
  await clearLog()
  await cleanup(payload)
  await payload.destroy()
})

describe('inviting someone', () => {
  it('refuses a person who is not an admin and makes nothing', async () => {
    const fellow = (await account('Invitation fellow', { roles: ['fellow'] })).user
    const email = uniqEmail('refused-fellow')
    const res = await create!.handler(await requestOf(valid(email), fellow))
    expect(res.status).toBe(403)
    expect(await keepCreated(email)).toBeUndefined()
  })

  it.each([
    [{ email: 'not an email' }, 'email'],
    [{ name: ' ' }, 'name'],
    [{ roles: ['wizard'] }, 'roles'],
  ])('refuses a wrong form (%o)', async (over, error) => {
    const res = await create!.handler(await requestOf(valid(uniqEmail('wrong-form'), over), admin))
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error })
  })

  it('refuses an address that already has an account', async () => {
    const existing = (await account('Invitation existing')).user
    const res = await create!.handler(await requestOf(valid(existing.email), admin))
    expect(res.status).toBe(409)
  })

  it('makes one account and no stray person when two invitations race for an address', async () => {
    const email = uniqEmail('race')
    const name = `Race ${uniq('person')}`
    network.use(http.post(EMAILS, () => sent('e_race')))
    const answers = await Promise.all([
      create!.handler(await requestOf(valid(email, { name }), admin)),
      create!.handler(await requestOf(valid(email, { name }), admin)),
    ])
    expect(answers.map((a) => a.status).sort()).toEqual([200, 409])
    await keepCreated(email)
    const people = await payload.count({
      collection: 'people',
      where: { name: { equals: name } },
      overrideAccess: true,
    })
    expect(people.totalDocs).toBe(1)
  })

  it('removes the new person again when the account cannot be made', async () => {
    const taken = (await account('Invitation taken')).user
    const name = `Rolled back ${uniq('person')}`
    const req = await requestOf({}, admin)
    await expect(
      createAccount(req, { email: taken.email, name, roles: ['member'] }),
    ).rejects.toBeInstanceOf(ValidationError)
    const left = await payload.count({
      collection: 'people',
      where: { name: { equals: name } },
      overrideAccess: true,
    })
    expect(left.totalDocs).toBe(0)
  })

  it('makes the account, sends a seven-day link in the chosen language and logs it', async () => {
    const email = uniqEmail('invited')
    const mails: { to: string; html: string }[] = []
    network.use(
      http.post(EMAILS, async ({ request }) => {
        mails.push((await request.json()) as { to: string; html: string })
        return sent('e_1')
      }),
    )
    const res = await create!.handler(await requestOf(valid(email), admin))
    const user = (await keepCreated(email))!
    expect(await res.json()).toEqual({ id: user.id, emailed: true })
    expect(mails).toHaveLength(1)
    expect(mails[0]!.to).toBe(email)
    const token = /\/ar\/welcome\/([\w-]+)/.exec(mails[0]!.html)?.[1]
    expect(token).toBeTruthy()
    const stored = await payload.findByID({
      collection: 'users',
      id: user.id,
      overrideAccess: true,
      showHiddenFields: true,
    })
    expect(stored.resetPasswordToken).toBe(token)
    const lifeMs = new Date(stored.resetPasswordExpiration!).getTime() - Date.now()
    expect(Math.abs(lifeMs - INVITATION_DAYS * 86_400_000)).toBeLessThan(60_000)
    expect(stored.invited_at).toBeTruthy()
    const log = await payload.count({
      collection: 'invitation-log',
      where: { user: { equals: user.id } },
      overrideAccess: true,
    })
    expect(log.totalDocs).toBe(1)
  })

  it('tries once more after a 429 from the rate limit', async () => {
    const email = uniqEmail('retried')
    let calls = 0
    network.use(
      http.post(EMAILS, () => {
        calls++
        return calls === 1 ? refused() : sent('e_2')
      }),
    )
    const res = await create!.handler(await requestOf(valid(email), admin))
    const user = (await keepCreated(email))!
    expect(await res.json()).toEqual({ id: user.id, emailed: true })
    expect(calls).toBe(2)
  })

  it('keeps the account when the email fails, and says so', async () => {
    const email = uniqEmail('mail-down')
    network.use(http.post(EMAILS, () => HttpResponse.json({ message: 'down' }, { status: 500 })))
    const res = await create!.handler(await requestOf(valid(email), admin))
    const user = (await keepCreated(email))!
    expect(await res.json()).toEqual({ id: user.id, emailed: false })
  })

  it('counts the email as sent when only its record fails', async () => {
    const email = uniqEmail('unrecorded')
    const logged = vi.spyOn(payload.logger, 'error')
    network.use(
      http.post(EMAILS, async () => {
        const gone = await keepCreated(email)
        await payload.delete({ collection: 'users', id: gone!.id, overrideAccess: true })
        return sent('e_3')
      }),
    )
    const res = await create!.handler(await requestOf(valid(email), admin))
    expect(await res.json()).toMatchObject({ emailed: true })
    expect(logged).toHaveBeenCalledWith(
      expect.objectContaining({ msg: expect.stringContaining('sent but not recorded') }),
    )
    logged.mockRestore()
  })

  it('sends a new link to an existing account, and names the daily limit', async () => {
    const target = (await account('Invitation target')).user
    const req = await requestOf({ locale: 'en' }, admin, { id: String(target.id) })
    network.use(http.post(EMAILS, () => sent('e_4')))
    expect(await (await resend!.handler(req)).json()).toEqual({ sent: target.email })
    network.use(http.post(EMAILS, () => refused()))
    const res = await resend!.handler(req)
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'limit' })
  })
})

describe('inviting many accounts', () => {
  let releaseBudget: () => Promise<void>
  beforeAll(async () => {
    releaseBudget = await holdInvitationBudget('alone')
  })
  afterEach(clearLog)
  afterAll(() => releaseBudget())

  it('refuses more than one part at a time', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    expect((await many!.handler(await requestOf({ ids }, admin))).status).toBe(400)
  })

  it('skips admins, people who signed in, and people invited recently', async () => {
    const plain = (await account('Batch plain')).user
    const other = (await account('Batch admin', { roles: ['admin'] })).user
    const recent = (await account('Batch recent', { invited_at: new Date().toISOString() })).user
    const active = (await account('Batch active', { activated_at: '2026-01-01T00:00:00Z' })).user
    const google = (await account('Batch google', { sub: uniq('google-id') })).user
    network.use(http.post(EMAILS, () => sent('e_5')))
    const req = await requestOf({}, admin)
    const ids = [plain, other, recent, active, google].map((u) => u.id)
    const result = await inviteMany(req, ids, 'en', false)
    expect(result.sent).toEqual([plain.id])
    expect(result.skipped.toSorted()).toEqual(ids.slice(1).toSorted())
    expect(result.failed).toEqual([])
    expect(result.limited).toEqual([])
  })

  it('counts emails, not accounts: a person sent again today counts again', async () => {
    const accounts = await Promise.all([1, 2, 3].map((n) => account(`Batch cap ${n}`)))
    const req = await requestOf({}, admin)
    const room = BULK_INVITES_PER_DAY - 1 - (await invitationsToday(req))
    await Promise.all(
      Array.from({ length: room }, () =>
        payload.create({
          collection: 'invitation-log',
          data: { user: accounts[0]!.user.id },
          overrideAccess: true,
        }),
      ),
    )
    network.use(http.post(EMAILS, () => sent('e_6')))
    const ids = accounts.map((a) => a.user.id)
    const result = await inviteMany(req, ids, 'en', true)
    expect(result.sent).toHaveLength(1)
    expect(result.limited).toHaveLength(2)
    expect([...result.sent, ...result.limited].toSorted()).toEqual(ids.toSorted())
    expect(result.skipped).toEqual([])
    expect(result.failed).toEqual([])
  })

  it('stops at the daily limit of the email service after one retry', async () => {
    const accounts = await Promise.all([1, 2, 3].map((n) => account(`Batch limit ${n}`)))
    let calls = 0
    network.use(
      http.post(EMAILS, () => {
        calls++
        return calls === 1 ? sent('e_7') : refused()
      }),
    )
    const ids = accounts.map((a) => a.user.id)
    const req = await requestOf({}, admin)
    const result = await inviteMany(req, ids, 'ar', false)
    expect(result.sent).toHaveLength(1)
    expect(result.limited).toHaveLength(2)
    expect([...result.sent, ...result.limited].toSorted()).toEqual(ids.toSorted())
    expect(result.skipped).toEqual([])
    expect(result.failed).toEqual([])
    expect(calls).toBe(3)
  })
})

describe('signing in', () => {
  it('knows an account is in use from a password sign-in or Google', () => {
    expect(hasSignedIn({ activated_at: null, sub: null })).toBe(false)
    expect(hasSignedIn({ activated_at: '2026-01-01T00:00:00Z', sub: null })).toBe(true)
    expect(hasSignedIn({ activated_at: null, sub: 'g' })).toBe(true)
  })

  const activatedAt = async (id: number) =>
    (await payload.findByID({ collection: 'users', id, overrideAccess: true, depth: 0 }))
      .activated_at

  it('records the first sign-in once', async () => {
    const { user, password } = await account('Signing in')
    expect(await activatedAt(user.id)).toBeFalsy()
    await payload.login({ collection: 'users', data: { email: user.email, password } })
    const first = await activatedAt(user.id)
    expect(first).toBeTruthy()
    await payload.login({ collection: 'users', data: { email: user.email, password } })
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { roles: ['member'] },
      overrideAccess: true,
    })
    expect(await activatedAt(user.id)).toBe(first)
  })

  it('records the first password set from a link', async () => {
    const { user } = await account('Setting a password')
    const token = await payload.forgotPassword({
      collection: 'users',
      data: { email: user.email },
      disableEmail: true,
    })
    await payload.resetPassword({
      collection: 'users',
      data: { token, password: crypto.randomUUID() },
      overrideAccess: true,
    })
    expect(await activatedAt(user.id)).toBeTruthy()
  })
})

describe('accepting an invitation', () => {
  const invited = async (name: string) => {
    const made = await account(name, { invited_at: '2026-11-01T00:00:00.000Z' })
    const link = `/admin/collections/users/${made.user.id}`
    noteLinks.push(link)
    return { ...made, link }
  }
  const notes = async (link: string) =>
    (
      await payload.find({
        collection: 'notifications',
        where: { link: { equals: link } },
        overrideAccess: true,
        depth: 0,
        pagination: false,
      })
    ).docs

  it('tells the other admins when an invited account first signs in', async () => {
    const { user, password, link } = await invited('Mona Accepted')
    await payload.login({ collection: 'users', data: { email: user.email, password } })
    const made = await notes(link)
    expect(made.map((n) => n.recipient)).toContain(admin.id)
    expect(made.map((n) => n.recipient)).not.toContain(user.id)
    expect(made[0]).toMatchObject({
      kind: 'joined',
      description: 'Mona Accepted accepted the invitation',
      link,
      actor_name: 'Mona Accepted',
    })
  })

  it('counts a first Google sign-in', async () => {
    const { user, link } = await invited('Google Accepted')
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { sub: uniq('google-id') },
      overrideAccess: true,
    })
    expect((await notes(link)).map((n) => n.recipient)).toContain(admin.id)
  })

  it('stays quiet for later sign-ins and for accounts nobody invited', async () => {
    const { user, password, link } = await invited('Later Accepted')
    await payload.login({ collection: 'users', data: { email: user.email, password } })
    const before = (await notes(link)).length
    await payload.update({
      collection: 'users',
      id: user.id,
      data: { sub: uniq('google-id') },
      overrideAccess: true,
    })
    expect((await notes(link)).length).toBe(before)

    const stranger = await account('Uninvited')
    const strangerLink = `/admin/collections/users/${stranger.user.id}`
    noteLinks.push(strangerLink)
    await payload.login({
      collection: 'users',
      data: { email: stranger.user.email, password: stranger.password },
    })
    expect(await notes(strangerLink)).toHaveLength(0)
  })

  it('is the hook the users collection runs after a change', () => {
    expect(
      payload.collections.users.config.hooks.afterChange.some(
        (hook) => hook === announceAcceptance,
      ),
    ).toBe(true)
  })
})

describe('setPasswordLink', () => {
  it('refuses an address with no account', async () => {
    const req = await requestOf({}, admin)
    await expect(setPasswordLink(req, { id: 3, email: uniqEmail('nobody') }, 'en')).rejects.toThrow(
      'no account',
    )
  })
})
