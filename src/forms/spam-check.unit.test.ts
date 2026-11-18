import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'

import { requireTurnstile } from '@/forms/spam-check'
import { TURNSTILE_HEADER } from '@/lib/turnstile'

import { mockNetwork } from '../../testing/msw-node.test-utils'

type Args = Parameters<ReturnType<typeof requireTurnstile>>[0]

const run = (
  secret: string | undefined,
  {
    headers = {},
    user = null,
    payloadAPI = 'REST',
    operation = 'create',
  }: {
    headers?: Record<string, string>
    user?: unknown
    payloadAPI?: string
    operation?: 'create' | 'update'
  } = {},
) =>
  requireTurnstile(secret)({
    data: { form: 1 },
    operation,
    req: { headers: new Headers(headers), user, payloadAPI },
  } as unknown as Args)

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const network = mockNetwork()

const cloudflare = (success: boolean) => {
  const forms: Record<string, string>[] = []
  network.use(
    http.post(SITEVERIFY, async ({ request }) => {
      forms.push(Object.fromEntries(await request.formData()) as Record<string, string>)
      return HttpResponse.json({ success })
    }),
  )
  return forms
}

describe('requireTurnstile', () => {
  it('lets every post through without a secret', async () => {
    await expect(run(undefined)).resolves.toEqual({ form: 1 })
  })

  it('refuses a post without a token', async () => {
    await expect(run('secret')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses a token Cloudflare rejects', async () => {
    cloudflare(false)
    await expect(run('secret', { headers: { [TURNSTILE_HEADER]: 'bad' } })).rejects.toMatchObject({
      status: 403,
    })
  })

  it('refuses when Cloudflare cannot be reached', async () => {
    network.use(http.post(SITEVERIFY, () => HttpResponse.error()))
    await expect(run('secret', { headers: { [TURNSTILE_HEADER]: 'tok' } })).rejects.toMatchObject({
      status: 403,
    })
  })

  it('accepts a good token and sends the visitor IP', async () => {
    const forms = cloudflare(true)
    await expect(
      run('secret', { headers: { [TURNSTILE_HEADER]: 'tok', 'cf-connecting-ip': '203.0.113.9' } }),
    ).resolves.toEqual({ form: 1 })
    expect(forms).toEqual([{ secret: 'secret', response: 'tok', remoteip: '203.0.113.9' }])
  })

  it('skips the Local API, admins and updates', async () => {
    await expect(run('secret', { payloadAPI: 'local' })).resolves.toBeTruthy()
    await expect(run('secret', { user: { id: 1, roles: ['admin'] } })).resolves.toBeTruthy()
    await expect(run('secret', { operation: 'update' })).resolves.toBeTruthy()
  })

  it('checks signed-in members like visitors', async () => {
    await expect(run('secret', { user: { id: 2, roles: ['student'] } })).rejects.toMatchObject({
      status: 403,
    })
  })
})
