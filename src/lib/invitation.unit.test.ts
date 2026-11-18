// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import type { PayloadRequest } from 'payload'
import { ValidationError } from 'payload'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  announceAcceptance,
  BULK_INVITES_PER_DAY,
  hasSignedIn,
  INVITATION_DAYS,
  invitationEndpoints,
  inviteMany,
  markActivated,
  setPasswordLink,
} from '@/lib/invitation'

const [create, many, resend] = invitationEndpoints

type Mail = { to: string; html: string }
const refused = () => Object.assign(new Error('429'), { status: 429 })

/** A request with a Payload that records what it was asked to do. */
const requestOf = (
  body: Record<string, unknown>,
  { roles = ['admin'], users = 0, sentToday = 0 } = {},
) => {
  const payload = {
    count: vi.fn(async ({ collection }: { collection: string }) => ({
      totalDocs: collection === 'invitation-log' ? sentToday : users,
    })),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === 'people' ? 7 : 42,
    })),
    delete: vi.fn(async () => ({})),
    findByID: vi.fn(async () => ({ id: 42, email: 'mona@example.com', person: { name: 'Mona' } })),
    findGlobal: vi.fn(async () => ({})),
    forgotPassword: vi.fn(async () => 'token-1'),
    sendEmail: vi.fn(async (_mail: Mail) => undefined),
    update: vi.fn(async () => ({})),
    find: vi.fn(async () => ({ docs: [] as unknown[] })),
    logger: { error: vi.fn() },
  }
  const req = {
    user: { id: 1, roles },
    payload,
    json: async () => body,
    routeParams: { id: '42' },
  } as unknown as PayloadRequest
  return { req, payload }
}

const valid = { email: 'Mona@Example.com ', name: 'Mona Adel', roles: ['member'], locale: 'ar' }

beforeEach(() => vi.useFakeTimers({ toFake: ['setTimeout'] }))
afterEach(() => vi.useRealTimers())

/** Runs a call that waits between sends, with the waits skipped. */
const settled = async <T>(promise: Promise<T> | T) => {
  await vi.runAllTimersAsync()
  return promise
}

describe('inviting someone', () => {
  it('refuses a person who is not an admin', async () => {
    const { req, payload } = requestOf(valid, { roles: ['fellow'] })
    expect((await create!.handler(req)).status).toBe(403)
    expect(payload.create).not.toHaveBeenCalled()
  })

  it.each([
    [{ ...valid, email: 'not an email' }, 'email'],
    [{ ...valid, name: ' ' }, 'name'],
    [{ ...valid, roles: ['wizard'] }, 'roles'],
  ])('refuses a wrong form (%o)', async (body, error) => {
    const res = await create!.handler(requestOf(body).req)
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error })
  })

  it('refuses an address that already has an account', async () => {
    expect((await create!.handler(requestOf(valid, { users: 1 }).req)).status).toBe(409)
  })

  it('removes the new person when the address was taken a moment ago', async () => {
    const { req, payload } = requestOf(valid)
    payload.create
      .mockResolvedValueOnce({ id: 7 })
      .mockRejectedValueOnce(new ValidationError({ errors: [{ message: 'taken', path: 'email' }] }))
    expect((await create!.handler(req)).status).toBe(409)
    expect(payload.delete).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'people', id: 7 }),
    )
  })

  it('makes the account, sends a seven-day link in the chosen language and logs it', async () => {
    const { req, payload } = requestOf(valid)
    expect(await (await settled(create!.handler(req))).json()).toEqual({ id: 42, emailed: true })
    expect(payload.forgotPassword).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { email: 'mona@example.com' },
        disableEmail: true,
        expiration: INVITATION_DAYS * 86_400_000,
      }),
    )
    const mail = payload.sendEmail.mock.calls[0]![0]
    expect(mail.to).toBe('mona@example.com')
    expect(mail.html).toContain('/ar/welcome/token-1')
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'users', id: 42 }),
    )
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'invitation-log', data: { user: 42 } }),
    )
  })

  it('tries once more after a 429 from the rate limit', async () => {
    const { req, payload } = requestOf(valid)
    payload.sendEmail.mockRejectedValueOnce(refused())
    expect(await (await settled(create!.handler(req))).json()).toEqual({ id: 42, emailed: true })
    expect(payload.sendEmail).toHaveBeenCalledTimes(2)
  })

  it('keeps the account when the email fails, and says so', async () => {
    const { req, payload } = requestOf(valid)
    payload.sendEmail.mockRejectedValue(new Error('down'))
    expect(await (await settled(create!.handler(req))).json()).toEqual({ id: 42, emailed: false })
  })

  it('counts the email as sent when only its record fails', async () => {
    const { req, payload } = requestOf(valid)
    payload.update.mockRejectedValueOnce(new Error('db'))
    expect(await (await settled(create!.handler(req))).json()).toEqual({ id: 42, emailed: true })
    expect(payload.logger.error).toHaveBeenCalled()
  })

  it('sends a new link to an existing account, and names the daily limit', async () => {
    const { req, payload } = requestOf({ locale: 'en' })
    expect(await (await settled(resend!.handler(req))).json()).toEqual({
      sent: 'mona@example.com',
    })
    payload.sendEmail.mockRejectedValue(refused())
    const res = await settled(resend!.handler(req))
    expect(res.status).toBe(429)
    expect(await res.json()).toEqual({ error: 'limit' })
  })
})

describe('inviting many accounts', () => {
  const account = (id: number, extra: Record<string, unknown> = {}) => ({
    id,
    email: `p${id}@example.com`,
    roles: ['member'],
    person: { name: `Person ${id}` },
    ...extra,
  })

  it('refuses more than one part at a time', async () => {
    const ids = Array.from({ length: 11 }, (_, i) => i + 1)
    expect((await many!.handler(requestOf({ ids }).req)).status).toBe(400)
  })

  it('skips admins, people who signed in, and people invited recently', async () => {
    const { req, payload } = requestOf({})
    payload.find.mockResolvedValueOnce({
      docs: [
        account(1),
        account(2, { roles: ['admin'] }),
        account(3, { invited_at: new Date().toISOString() }),
        account(4, { activated_at: '2026-01-01T00:00:00Z' }),
        account(5, { sub: 'google-id' }),
      ],
    })
    expect(await settled(inviteMany(req, [1, 2, 3, 4, 5], 'en', false))).toEqual({
      sent: [1],
      skipped: [2, 3, 4, 5],
      failed: [],
      limited: [],
    })
  })

  it('counts emails, not accounts: a person sent again today counts again', async () => {
    const { req, payload } = requestOf({}, { sentToday: BULK_INVITES_PER_DAY - 1 })
    payload.find.mockResolvedValueOnce({ docs: [account(1), account(2), account(3)] })
    expect(await settled(inviteMany(req, [1, 2, 3], 'en', true))).toEqual({
      sent: [1],
      skipped: [],
      failed: [],
      limited: [2, 3],
    })
    expect(payload.count).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'invitation-log' }),
    )
  })

  it('stops at the daily limit of the email service after one retry', async () => {
    const { req, payload } = requestOf({})
    payload.find.mockResolvedValueOnce({ docs: [account(1), account(2), account(3)] })
    payload.sendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(refused())
      .mockRejectedValueOnce(refused())
    expect(await settled(inviteMany(req, [1, 2, 3], 'ar', false))).toEqual({
      sent: [1],
      skipped: [],
      failed: [],
      limited: [2, 3],
    })
    expect(payload.sendEmail).toHaveBeenCalledTimes(3)
  })
})

describe('signing in', () => {
  it('knows an account is in use from a password sign-in or Google', () => {
    expect(hasSignedIn({ activated_at: null, sub: null })).toBe(false)
    expect(hasSignedIn({ activated_at: '2026-01-01T00:00:00Z', sub: null })).toBe(true)
    expect(hasSignedIn({ activated_at: null, sub: 'g' })).toBe(true)
  })

  it('records the first sign-in and the first password from a link, once', async () => {
    const { req, payload } = requestOf({})
    const run = (operation: string, user: Record<string, unknown>) =>
      markActivated({ operation, result: { user }, req } as never)
    await run('resetPassword', { id: 9, activated_at: null })
    await run('login', { id: 9, activated_at: '2026-01-01T00:00:00Z' })
    await run('update', { id: 9, activated_at: null })
    expect(payload.update).toHaveBeenCalledOnce()
    expect(payload.update).toHaveBeenCalledWith(expect.objectContaining({ id: 9 }))
  })
})

describe('accepting an invitation', () => {
  type Doc = Parameters<typeof announceAcceptance>[0]['doc']
  const invited = {
    id: 42,
    email: 'mona@example.com',
    person: 7,
    invited_at: '2026-11-01T00:00:00.000Z',
  } as unknown as Doc
  const run = (doc: Doc, previousDoc: Doc, operation: 'create' | 'update' = 'update') => {
    const { req, payload } = requestOf({})
    payload.find.mockResolvedValue({
      docs: [
        { id: 1, email: 'admin@example.com' },
        { id: 42, email: 'mona@example.com' },
      ],
    })
    payload.findByID.mockResolvedValue({ id: 7, name: 'Mona', photo: null } as never)
    const hook = announceAcceptance as unknown as (args: object) => Promise<unknown>
    return hook({ doc, previousDoc, operation, req }).then(() =>
      payload.create.mock.calls.map(
        ([args]) => args as unknown as { data: Record<string, unknown> },
      ),
    )
  }

  it('tells the other admins when an invited account first signs in', async () => {
    const notes = await run({ ...invited, activated_at: '2026-11-12T00:00:00.000Z' }, invited)
    expect(notes).toHaveLength(1)
    expect(notes[0]!.data).toMatchObject({
      recipient: 1,
      kind: 'joined',
      description: 'Mona accepted the invitation',
      link: '/admin/collections/users/42',
      actor_name: 'Mona',
    })
  })

  it('counts a first Google sign-in', async () => {
    expect(await run({ ...invited, sub: 'google-1' }, invited)).toHaveLength(1)
  })

  it('stays quiet for later sign-ins and for accounts nobody invited', async () => {
    const active = { ...invited, activated_at: '2026-11-12T00:00:00.000Z' }
    expect(await run({ ...active, sub: 'google-1' }, active)).toHaveLength(0)
    const uninvited = { ...active, invited_at: null }
    expect(await run(uninvited, { ...uninvited, activated_at: null })).toHaveLength(0)
  })
})

describe('setPasswordLink', () => {
  it('refuses an address with no account', async () => {
    const { req, payload } = requestOf({})
    payload.forgotPassword.mockResolvedValueOnce(null as unknown as string)
    await expect(setPasswordLink(req, { id: 3, email: 'x@y.co' }, 'en')).rejects.toThrow(
      'no account',
    )
  })
})
