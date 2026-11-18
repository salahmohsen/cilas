import { createLocalReq, getPayload, type Payload } from 'payload'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { env } from '@/env'
import config from '@/payload.config'
import type { Newsletter, User } from '@/payload-types'

import { mockNetwork } from '../testing/msw-node.test-utils'
import { uniq, uniqEmail } from '../testing/payload.fixture'

let payload: Payload
let admin: User
let issue: Newsletter
let list: { id: number } | null = null
const ADMIN = uniqEmail('newsletter-admin-probe')

const call = async (action: 'test' | 'send', user: User | null = admin) => {
  const endpoints = payload.collections.newsletters.config.endpoints as {
    path: string
    handler: (req: never) => Promise<Response>
  }[]
  const req = await createLocalReq({ user: user ?? undefined }, payload)
  req.routeParams = { id: String(issue.id) }
  return endpoints.find((e) => e.path === `/:id/${action}`)!.handler(req as never)
}

let contacts = 0
const emails: { to: string; subject: string }[] = []
const broadcasts: { html: string }[] = []
mockNetwork(
  http.post(
    'https://telemetry.payloadcms.com/events',
    () => new HttpResponse(null, { status: 204 }),
  ),
  http.post('https://api.resend.com/emails', async ({ request }) => {
    emails.push((await request.json()) as { to: string; subject: string })
    return HttpResponse.json({ id: 'e_probe' })
  }),
  http.post('https://api.resend.com/broadcasts', async ({ request }) => {
    broadcasts.push((await request.json()) as { html: string })
    return HttpResponse.json({ id: 'b_probe' })
  }),
  http.get('https://api.resend.com/segments/seg_probe/contacts', () =>
    HttpResponse.json({ data: [], has_more: false }),
  ),
  http.get('https://api.resend.com/segments/metrics', () =>
    HttpResponse.json({ totals: { all_contacts: contacts } }),
  ),
)

describe('sending a newsletter issue', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = await payload.create({
      collection: 'users',
      data: { email: ADMIN, password: 'probe-password-1', roles: ['admin'] },
    })
    list = await payload.create({
      collection: 'mailing-lists',
      data: {
        name: uniq('Probe list'),
        source: 'members',
        segment_id: 'seg_probe',
        members: { users: [] },
      },
      context: { mailingListSyncWrite: true },
    })
    issue = await payload.create({
      collection: 'newsletters',
      data: {
        title: 'Probe issue',
        slug: uniq('probe-issue'),
        issue_date: '2026-10-18',
        send_to: list.id,
      },
      draft: true,
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'newsletters', id: issue.id }).catch(() => undefined)
    if (list)
      await payload.delete({ collection: 'mailing-lists', id: list.id }).catch(() => undefined)
    await payload.delete({ collection: 'users', id: admin.id }).catch(() => undefined)
    await payload.destroy()
  })

  it('sends a test only to the admin', async () => {
    const res = await call('test')
    expect(res.status).toBe(200)
    expect(emails).toEqual([expect.objectContaining({ to: ADMIN, subject: '[Test] Probe issue' })])
  })

  it('refuses people who are not admins', async () => {
    expect((await call('send', null)).status).toBe(403)
  })

  it.runIf(Boolean(env.RESEND_API_KEY))('stops above the free plan’s contact limit', async () => {
    contacts = 1200
    const res = await call('send')
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('1200 contacts')
    expect(broadcasts).toEqual([])
  })

  it.runIf(Boolean(env.RESEND_API_KEY))('sends once, then publishes the issue', async () => {
    contacts = 640
    expect((await call('send')).status).toBe(200)
    expect(broadcasts).toHaveLength(1)
    expect(broadcasts[0]!.html).toContain('{{{RESEND_UNSUBSCRIBE_URL}}}')
    const after = await payload.findByID({ collection: 'newsletters', id: issue.id, depth: 0 })
    expect(after).toMatchObject({ _status: 'published', broadcast_id: 'b_probe' })
    expect((await call('send')).status).toBe(409)
  })
})
