// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { INVITATION_DAYS, invitationEndpoints, inviteMany, setPasswordLink } from '@/lib/invitation'

const [create, many, resend] = invitationEndpoints

/** A request with a Payload that records what it was asked to do. */
const requestOf = (
  body: Record<string, unknown>,
  { roles = ['admin'], users = 0 }: { roles?: string[]; users?: number } = {},
) => {
  const payload = {
    count: vi.fn(async () => ({ totalDocs: users })),
    create: vi.fn(async ({ collection }: { collection: string }) => ({
      id: collection === 'people' ? 7 : 42,
    })),
    findByID: vi.fn(async () => ({ id: 42, email: 'mona@example.com', person: { name: 'Mona' } })),
    findGlobal: vi.fn(async () => ({})),
    forgotPassword: vi.fn(async () => 'token-1'),
    sendEmail: vi.fn(async (_mail: { to: string; html: string }) => undefined),
    update: vi.fn(async () => ({ docs: [] })),
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
    const res = await create!.handler(requestOf(valid, { users: 1 }).req)
    expect(res.status).toBe(409)
  })

  it('makes the account and sends a seven-day link in the chosen language', async () => {
    const { req, payload } = requestOf(valid)
    const res = await create!.handler(req)
    expect(await res.json()).toEqual({ id: 42, emailed: true })
    expect(payload.create).toHaveBeenCalledWith(
      expect.objectContaining({
        collection: 'users',
        data: expect.objectContaining({ email: 'mona@example.com', roles: ['member'], person: 7 }),
      }),
    )
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
  })

  it('keeps the account when the email fails, and says so', async () => {
    const { req, payload } = requestOf(valid)
    payload.sendEmail.mockRejectedValueOnce(new Error('down'))
    expect(await (await create!.handler(req)).json()).toEqual({ id: 42, emailed: false })
  })

  it('sends a new link to an existing account', async () => {
    const { req, payload } = requestOf({ locale: 'en' })
    expect(await (await resend!.handler(req)).json()).toEqual({ sent: 'mona@example.com' })
    expect(payload.sendEmail).toHaveBeenCalledOnce()
  })
})

describe('setPasswordLink', () => {
  it('refuses an address with no account', async () => {
    const { req, payload } = requestOf({})
    payload.forgotPassword.mockResolvedValueOnce(null as unknown as string)
    await expect(setPasswordLink(req, 'x@y.co', 'en')).rejects.toThrow('No account')
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
    const ids = Array.from({ length: 26 }, (_, i) => i + 1)
    expect((await many!.handler(requestOf({ ids }).req)).status).toBe(400)
  })

  it('skips admins and people invited recently, and records each one sent', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { req, payload } = requestOf({})
    payload.find.mockResolvedValueOnce({
      docs: [
        account(1),
        account(2, { roles: ['admin'] }),
        account(3, { invited_at: new Date().toISOString() }),
      ],
    })
    const done = inviteMany(req, [1, 2, 3], 'en', false)
    await vi.runAllTimersAsync()
    expect(await done).toEqual({ sent: [1], skipped: [2, 3], failed: [], limited: [] })
    expect(payload.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: 'p1@example.com' } } }),
    )
    vi.useRealTimers()
  })

  it('stops at the daily limit and lists who was not tried', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] })
    const { req, payload } = requestOf({})
    payload.find.mockResolvedValueOnce({ docs: [account(1), account(2), account(3)] })
    payload.sendEmail
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(Object.assign(new Error('quota'), { status: 429 }))
    const done = inviteMany(req, [1, 2, 3], 'ar', false)
    await vi.runAllTimersAsync()
    expect(await done).toEqual({ sent: [1], skipped: [], failed: [], limited: [2, 3] })
    expect(payload.sendEmail).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
