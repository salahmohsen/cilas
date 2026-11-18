import posthog from 'posthog-js'
import { http, HttpResponse } from 'msw'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { posthogConfig } from '@/lib/analytics/client'

import { mockNetwork } from '../../../testing/msw-node.test-utils'

mockNetwork(http.all('https://ci-las.test/relay-k3/*', () => HttpResponse.json({})))

type Capture = { event: string; properties: Record<string, unknown> }

const PRIVATE = ['SECRET123', 'private query', '/spaces', 'my-space', '/reset', 'jane-doe']

describe('what the real PostHog sends after the gate', () => {
  const seen: Capture[] = []
  const sent: Capture[] = []

  beforeAll(() => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      get: () => 'https://www.google.com/search?q=private+query',
    })
    window.history.replaceState({}, '', '/en/reset?token=SECRET123')

    const config = posthogConfig()
    const gate = config.before_send as (c: Capture | null) => Capture | null
    posthog.init(
      'phc_contract_test',
      {
        ...config,
        api_host: 'https://ci-las.test/relay-k3',
        before_send: (capture) => {
          if (capture) seen.push(capture as Capture)
          const out = gate(capture as Capture | null)
          if (out) sent.push(out)
          return null
        },
      },
      'contract',
    )
  })

  afterAll(() => {
    Reflect.deleteProperty(document, 'referrer')
    window.history.replaceState({}, '', '/')
  })

  it('sends nothing from where a visit started, the page before, or a search', async () => {
    await vi.waitFor(() => expect(seen.some((c) => c.event === '$pageview')).toBe(true))
    expect(sent).toEqual([])

    window.history.pushState({}, '', '/en/spaces/my-space/posts/42')
    window.history.pushState({}, '', '/en/people/jane-doe')
    window.history.pushState({}, '', '/en/about')

    await vi.waitFor(() =>
      expect(sent.some((c) => c.properties.$pathname === '/en/about')).toBe(true),
    )
    const views = sent.filter((c) => c.event === '$pageview')
    expect(views.map((c) => c.properties.$pathname)).toEqual(['/en/people/[person]', '/en/about'])

    const text = JSON.stringify(sent)
    for (const leak of PRIVATE) expect(text).not.toContain(leak)
    expect(views.at(-1)?.properties).toMatchObject({
      $current_url: expect.stringMatching(/\/en\/about$/),
      $referrer: 'https://www.google.com/search',
      $prev_pageview_pathname: '/en/people/[person]',
    })
  })
})
