/**
 * The gate against the real posthog-js, not against hand-made events: the SDK
 * adds properties of its own (where a visit started, the page before), and
 * each new version can add more. This runs the site's own PostHog settings
 * and reads what the gate would let leave the browser.
 */
import posthog from 'posthog-js'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { posthogConfig } from '@/lib/analytics/client'

type Capture = { event: string; properties: Record<string, unknown> }

const PRIVATE = ['SECRET123', 'private query', '/spaces', 'my-space', '/reset', 'jane-doe']

describe('what the real PostHog sends after the gate', () => {
  const seen: Capture[] = []
  const sent: Capture[] = []

  // Each test: the config unstubs globals after every test.
  const stubNetwork = () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')))
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: vi.fn(() => true) })
  }
  beforeEach(stubNetwork)

  beforeAll(() => {
    stubNetwork()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      get: () => 'https://www.google.com/search?q=private+query',
    })
    // A visit that starts on a private page with a token in its address.
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
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    Reflect.deleteProperty(document, 'referrer')
    window.history.replaceState({}, '', '/')
  })

  it('sends nothing from where a visit started, the page before, or a search', async () => {
    // The first page view, on the private page, is raised and dropped.
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
