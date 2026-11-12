// @vitest-environment node
// React Email renders with react-dom/server, which needs Node's streams.
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

import { INVITATION_DAYS, invitationEndpoints, setPasswordLink } from '@/lib/invitation'

const [create, resend] = invitationEndpoints

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
