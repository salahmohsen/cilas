import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routing } from '@/i18n/routing'
import { isBotPath, isNoisyError } from '@/lib/analytics/errors'
import { INGEST_PATH, posthogHosts, relayRequest } from '@/lib/analytics/hosts'
import {
  EXCLUDED_SECTIONS,
  TRACKED_SECTIONS,
  isTrackedPath,
  reportedPath,
  stripLocale,
} from '@/lib/analytics/paths'
import { gateCapture, mayCapture } from '@/lib/analytics/policy'
import { scrubReferrer, scrubText, scrubUrl } from '@/lib/analytics/scrub'
import { STAFF_FLAG, isStaffDevice, makeBeforeSend, posthogConfig } from '@/lib/analytics/client'
import { setSender, track } from '@/lib/analytics/track'

describe('which pages analytics may see', () => {
  it('keeps its language list in step with the site routing', () => {
    expect(stripLocale(`/${routing.locales[0]}/about`)).toBe('/about')
    for (const locale of routing.locales) expect(stripLocale(`/${locale}`)).toBe('/')
  })

  it.each([
    '/en',
    '/ar',
    '/en/',
    '/en/about',
    '/ar/articles/some-post',
    '/en/events/open-day',
    '/en/study/bridge',
    '/en/study/data-science/apply',
    '/en/apply',
    '/en/calendar',
    '/en/contact',
    '/en/governance',
    '/en/people/fellows',
  ])('tracks %s', (path) => {
    expect(isTrackedPath(path)).toBe(true)
  })

  it.each([
    '/en/spaces',
    '/en/spaces/12/posts/4',
    '/ar/spaces',
    '/en/settings',
    '/en/settings/notifications',
    '/en/profile',
    '/en/login',
    '/en/forgot',
    '/en/reset/abc123',
    '/en/signed-in/study/x',
    '/admin',
    '/admin/collections/users',
    '/api/users/me',
    '/relay-k3/e/',
    '/en/events/preview',
    '/en/events/preview/9',
    '/en/unknown-section',
    '/uploads/old.pdf',
  ])('does not track %s', (path) => {
    expect(isTrackedPath(path)).toBe(false)
  })

  it('never lists a private section as public', () => {
    for (const section of EXCLUDED_SECTIONS) {
      expect(TRACKED_SECTIONS as readonly string[]).not.toContain(section)
      expect(isTrackedPath(`/en/${section}`)).toBe(false)
      expect(isTrackedPath(`/en/${section}/anything`)).toBe(false)
    }
  })

  it('ignores a query or hash when it decides', () => {
    expect(isTrackedPath('/en/about?next=/en/spaces')).toBe(true)
    expect(isTrackedPath('/en/spaces?utm_source=x#top')).toBe(false)
  })

  it('reports a person page without the name in its address', () => {
    expect(reportedPath('/en/people/jane-doe')).toBe('/en/people/[person]')
    expect(reportedPath('/en/people/fellows')).toBe('/en/people/fellows')
    expect(reportedPath('/ar/articles/hello')).toBe('/ar/articles/hello')
  })
})

describe('cleaning addresses', () => {
  it('keeps campaign tags and drops every other query and the hash', () => {
    expect(scrubUrl('https://ci-las.org/en/about?utm_source=news&token=abc&email=a@b.co#x')).toBe(
      'https://ci-las.org/en/about?utm_source=news',
    )
  })

  it('hides a person in the address', () => {
    expect(scrubUrl('https://ci-las.org/en/people/jane-doe?x=1')).toBe(
      'https://ci-las.org/en/people/[person]',
    )
  })

  it('returns a path alone when given one', () => {
    expect(scrubUrl('/en/about?code=1')).toBe('/en/about')
  })

  it('cuts a referrer to origin and path', () => {
    expect(scrubReferrer('https://www.google.com/search?q=private+words')).toBe(
      'https://www.google.com/search',
    )
    expect(scrubReferrer('https://t.co/')).toBe('https://t.co')
    expect(scrubReferrer('not a url')).toBe('')
  })

  it('removes secrets and emails from text', () => {
    const clean = scrubText('failed for jo@example.org at /x?token=abc123&y=1 password=hunter2')
    expect(clean).not.toContain('jo@example.org')
    expect(clean).not.toContain('abc123')
    expect(clean).not.toContain('hunter2')
    expect(clean).toContain('[email]')
  })

  it('cuts long text', () => {
    expect(scrubText('x'.repeat(1000), 50)).toHaveLength(50)
  })
})

describe('the last gate before an event leaves', () => {
  it('drops page views and errors from private pages', () => {
    for (const event of ['$pageview', '$exception', '$snapshot', 'apply_started']) {
      expect(
        gateCapture({ event, properties: { $current_url: 'https://ci-las.org/en/spaces/1' } }),
      ).toBeNull()
      expect(
        gateCapture({ event, properties: { $current_url: 'https://ci-las.org/admin/x' } }),
      ).toBeNull()
    }
  })

  it('lets login and push_enabled through without a page or a referrer', () => {
    const out = gateCapture({
      event: 'login',
      properties: {
        $current_url: 'https://ci-las.org/en/login?next=/en/spaces/private',
        $pathname: '/en/login',
        $referrer: 'https://ci-las.org/en/spaces',
        method: 'password',
      },
    })
    expect(out?.properties).toEqual({
      $current_url: '/[private]',
      $pathname: '/[private]',
      method: 'password',
    })
    expect(mayCapture('push_enabled', '/en/settings')).toBe(true)
    expect(mayCapture('contact_submitted', '/en/settings')).toBe(false)
  })

  it('cleans the address and referrer on a public page', () => {
    const out = gateCapture({
      event: '$pageview',
      properties: {
        $current_url: 'https://ci-las.org/en/study/x?utm_campaign=a&session=zzz',
        $pathname: '/en/study/x',
        $referrer: 'https://www.google.com/search?q=hello',
      },
    })
    expect(out?.properties).toMatchObject({
      $current_url: 'https://ci-las.org/en/study/x?utm_campaign=a',
      $referrer: 'https://www.google.com/search',
    })
  })

  it('cleans every address PostHog adds, not only the current one', () => {
    const out = gateCapture({
      event: '$pageview',
      properties: {
        $current_url: 'https://ci-las.org/en/about',
        $session_entry_url: 'https://ci-las.org/en/reset?token=SECRET',
        $session_entry_pathname: '/en/reset',
        $session_entry_referrer: 'https://www.google.com/search?q=private',
        $session_entry_ph_keyword: 'private',
        $prev_pageview_pathname: '/en/spaces/my-space/posts/42',
        $prev_pageview_duration: 3,
        $initial_current_url: 'https://ci-las.org/en/people/jane-doe?x=1',
        $external_click_url: 'https://partner.org/page?email=a@b.c',
        $sdk_debug_replay_url_trigger_status: 'pending',
      },
    })
    expect(out?.properties).toEqual({
      $current_url: 'https://ci-las.org/en/about',
      $session_entry_referrer: 'https://www.google.com/search',
      $prev_pageview_duration: 3,
      $initial_current_url: 'https://ci-las.org/en/people/[person]',
      $external_click_url: 'https://partner.org/page',
      $sdk_debug_replay_url_trigger_status: 'pending',
    })
  })

  it('drops a referrer from a private page of the site', () => {
    const out = gateCapture({
      event: '$pageview',
      properties: {
        $current_url: 'https://ci-las.org/en/about',
        $referrer: 'https://ci-las.org/en/spaces/my-space',
        $referring_domain: 'ci-las.org',
      },
    })
    expect(out?.properties).toEqual({
      $current_url: 'https://ci-las.org/en/about',
      $referring_domain: 'ci-las.org',
    })
  })

  it('keeps a public page of the site as referrer, without its query', () => {
    const out = gateCapture({
      event: '$pageview',
      properties: {
        $current_url: 'https://ci-las.org/en/about',
        $prev_pageview_pathname: '/en/people/jane-doe',
        $referrer: 'https://ci-las.org/en/study?q=x',
      },
    })
    expect(out?.properties).toMatchObject({
      $prev_pageview_pathname: '/en/people/[person]',
      $referrer: 'https://ci-las.org/en/study',
    })
  })

  it('sends an anywhere event with no address of any kind', () => {
    const out = gateCapture({
      event: 'login',
      properties: {
        $current_url: 'https://ci-las.org/en/login',
        $session_entry_url: 'https://ci-las.org/en/about?utm_source=x',
        $session_entry_ph_keyword: 'cilas',
        $prev_pageview_pathname: '/en/about',
        $prev_pageview_duration: 3,
        method: 'password',
      },
    })
    expect(out?.properties).toEqual({
      $current_url: '/[private]',
      $pathname: '/[private]',
      method: 'password',
    })
  })

  it('removes secrets and emails from a browser error message', () => {
    const out = gateCapture({
      event: '$exception',
      properties: {
        $current_url: 'https://ci-las.org/en/about',
        $exception_list: [
          { type: 'Error', value: 'GET /api/x?token=abc failed for reader@example.org' },
        ],
      },
    })
    expect(out?.properties?.$exception_list).toEqual([
      { type: 'Error', value: 'GET /api/x?token=[removed] failed for [email]' },
    ])
  })

  it('cleans the addresses nested in a web vital', () => {
    const out = gateCapture({
      event: '$web_vitals',
      properties: {
        $current_url: 'https://ci-las.org/en/people/jane-doe?ref=x&token=abc',
        $web_vitals_LCP_value: 1800,
        $web_vitals_LCP_event: {
          name: 'LCP',
          value: 1800,
          $current_url: 'https://ci-las.org/en/people/jane-doe?ref=x&token=abc',
          navigationURL: 'https://ci-las.org/en/people/jane-doe?token=abc',
          attribution: {
            target: 'main > img',
            url: 'https://ci-las.org/api/media/file/jane-doe.jpg?w=800',
            timeToFirstByte: 120,
          },
        },
        $web_vitals_INP_event: {
          name: 'INP',
          attribution: { url: 'https://cdn.example.org/font.woff2?v=2' },
        },
      },
    })
    expect(out?.properties).toEqual({
      $current_url: 'https://ci-las.org/en/people/[person]?ref=x',
      $web_vitals_LCP_value: 1800,
      $web_vitals_LCP_event: {
        name: 'LCP',
        value: 1800,
        $current_url: 'https://ci-las.org/en/people/[person]?ref=x',
        navigationURL: 'https://ci-las.org/en/people/[person]',
        attribution: { target: 'main > img', timeToFirstByte: 120 },
      },
      $web_vitals_INP_event: {
        name: 'INP',
        attribution: { url: 'https://cdn.example.org/font.woff2' },
      },
    })
  })

  it('drops a web vital measured on a private page', () => {
    expect(
      gateCapture({
        event: '$web_vitals',
        properties: {
          $current_url: 'https://ci-las.org/en/spaces/my-space',
          $web_vitals_LCP_value: 1,
        },
      }),
    ).toBeNull()
  })

  it('does not change what it was given', () => {
    const input = { event: '$pageview', properties: { $current_url: 'https://a.b/en?x=1' } }
    gateCapture(input)
    expect(input.properties.$current_url).toBe('https://a.b/en?x=1')
  })

  it('passes null through', () => {
    expect(gateCapture(null)).toBeNull()
  })
})

describe('noisy errors', () => {
  it.each([
    ['The operation was aborted.', 'AbortError'],
    ['Failed to fetch', 'TypeError'],
    ['Load failed', 'TypeError'],
    ['ResizeObserver loop completed with undelivered notifications.', 'Error'],
    ['NEXT_REDIRECT', 'Error'],
    ['chrome-extension://abc/inject.js', 'Error'],
  ])('ignores %s', (message, name) => {
    expect(isNoisyError(message, name)).toBe(true)
  })

  it('keeps a real error', () => {
    expect(isNoisyError('Cannot read properties of undefined (reading "title")', 'TypeError')).toBe(
      false,
    )
  })

  it('spots bot probes', () => {
    expect(isBotPath('/wp-admin/setup.php')).toBe(true)
    expect(isBotPath('/xmlrpc.php')).toBe(true)
    expect(isBotPath('/en/about')).toBe(false)
  })

  it('sends one of a repeated browser error, and caps a page at five', () => {
    const send = makeBeforeSend()
    vi.stubGlobal('location', { pathname: '/en/about' })
    const error = (value: string) => ({
      event: '$exception',
      properties: {
        $current_url: 'https://ci-las.org/en/about',
        $exception_list: [{ type: 'TypeError', value }],
      },
    })
    expect(send(error('boom 1'))).not.toBeNull()
    expect(send(error('boom 1'))).toBeNull()
    expect(send(error('Failed to fetch'))).toBeNull()
    for (const n of [2, 3, 4, 5]) expect(send(error(`boom ${n}`))).not.toBeNull()
    expect(send(error('boom 6'))).toBeNull()
    vi.unstubAllGlobals()
  })
})

describe('track', () => {
  const sent = vi.fn()
  beforeEach(() => {
    sent.mockReset()
    vi.stubGlobal('window', { location: { pathname: '/en/events/open-day' } })
  })
  afterEach(() => {
    setSender(null)
    vi.unstubAllGlobals()
  })

  it('does nothing while PostHog is off', () => {
    track('calendar_added', { source: 'event-ics' })
    expect(sent).not.toHaveBeenCalled()
  })

  it('sends on a public page', () => {
    setSender(sent)
    track('register_clicked', { kind: 'event', id: 'open-day' })
    expect(sent).toHaveBeenCalledWith('register_clicked', { kind: 'event', id: 'open-day' })
  })

  it('stays quiet on a private page, except for the two anywhere events', () => {
    setSender(sent)
    vi.stubGlobal('window', { location: { pathname: '/en/spaces' } })
    track('calendar_added', { source: 'event-ics' })
    expect(sent).not.toHaveBeenCalled()
    track('login', { method: 'password' })
    expect(sent).toHaveBeenCalledWith('login', { method: 'password' })
  })

  it('never throws, even when the sender does', () => {
    setSender(() => {
      throw new Error('network')
    })
    expect(() => track('calendar_added', { source: 'event-ics' })).not.toThrow()
  })
})

describe('what the browser is set to do', () => {
  const config = posthogConfig()

  it('is cookieless and captures nothing on its own', () => {
    expect(config.cookieless_mode).toBe('always')
    expect(config.person_profiles).toBe('identified_only')
    expect(config.autocapture).toBe(false)
    expect(config.capture_pageleave).toBe(false)
    expect(config.capture_heatmaps).toBe(false)
    expect(config.advanced_disable_feature_flags).toBe(true)
    expect(config.internal_or_test_user_hostname).toBeNull()
    expect(config.disable_surveys).toBe(true)
    expect(config.disable_session_recording).toBe(true)
    expect(config.respect_dnt).toBe(true)
  })

  it('measures web vitals, but never the network', () => {
    expect(config.capture_performance).toEqual({ web_vitals: true, network_timing: false })
  })

  it("uses PostHog's recommended defaults and puts its scripts in head", () => {
    expect(config.defaults).toBe('2026-08-30')
    expect(config.external_scripts_inject_target).toBe('head')
  })

  it('goes through the site', () => {
    expect(config.api_host).toBe(INGEST_PATH)
  })
})

describe('staff devices', () => {
  const storage = () => {
    const values = new Map<string, string>()
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    }
  }

  it('counts a device that never opened the admin panel', () => {
    expect(isStaffDevice(storage(), '/en/about')).toBe(false)
  })

  it('stops counting a device from the moment it opens the admin panel', () => {
    const local = storage()
    expect(isStaffDevice(local, '/admin')).toBe(true)
    expect(local.getItem(STAFF_FLAG)).toBe('1')
    expect(isStaffDevice(local, '/en/about')).toBe(true)
  })

  it('does not take a page that only starts with the word for the admin panel', () => {
    expect(isStaffDevice(storage(), '/administration')).toBe(false)
  })

  it('counts the device when the browser blocks storage', () => {
    const blocked = {
      getItem: () => {
        throw new Error('blocked')
      },
      setItem: () => {
        throw new Error('blocked')
      },
    }
    expect(isStaffDevice(blocked, '/en/about')).toBe(false)
    expect(isStaffDevice(blocked, '/admin')).toBe(true)
  })
})

describe('PostHog hosts', () => {
  it('derives the recorder and dashboard hosts for the EU cloud', () => {
    expect(posthogHosts('https://eu.i.posthog.com')).toEqual({
      ingest: 'https://eu.i.posthog.com',
      assets: 'https://eu-assets.i.posthog.com',
      ui: 'https://eu.posthog.com',
    })
  })

  it('falls back to the EU cloud on a blank host', () => {
    expect(posthogHosts('').ingest).toBe('https://eu.i.posthog.com')
  })

  const visit = (headers: Record<string, string>) => new Headers(headers)

  it('forwards the relay path only when a key is set, assets to the assets host', () => {
    const headers = visit({})
    expect(relayRequest(`${INGEST_PATH}/i/v0/e/`, headers, undefined)).toBeNull()
    expect(relayRequest('/en/about', headers, 'phc_x')).toBeNull()
    expect(relayRequest(`${INGEST_PATH}/i/v0/e/`, headers, 'phc_x')?.url).toBe(
      'https://eu.i.posthog.com/i/v0/e/',
    )
    expect(relayRequest(`${INGEST_PATH}/static/array.js`, headers, 'phc_x')?.url).toBe(
      'https://eu-assets.i.posthog.com/static/array.js',
    )
    expect(relayRequest(`${INGEST_PATH}/array/phc_x/config.js`, headers, 'phc_x')?.url).toBe(
      'https://eu-assets.i.posthog.com/array/phc_x/config.js',
    )
  })

  it("hands PostHog the visitor's own address, not the address of the proxy in front of the site", () => {
    const relayed = relayRequest(
      `${INGEST_PATH}/i/v0/e/`,
      visit({ 'cf-connecting-ip': '156.215.195.207', 'x-forwarded-for': '10.0.1.191' }),
      'phc_x',
    )
    expect(relayed?.headers.get('x-forwarded-for')).toBe('156.215.195.207')
  })

  it('keeps the first forwarded address when the site is reached without Cloudflare', () => {
    const relayed = relayRequest(
      `${INGEST_PATH}/i/v0/e/`,
      visit({ 'x-forwarded-for': '203.0.113.9, 10.0.1.191' }),
      'phc_x',
    )
    expect(relayed?.headers.get('x-forwarded-for')).toBe('203.0.113.9')
  })

  it("never sends the site's cookies, the login among them, to PostHog", () => {
    const relayed = relayRequest(
      `${INGEST_PATH}/i/v0/e/`,
      visit({ cookie: 'payload-token=secret; NEXT_LOCALE=en', 'content-type': 'text/plain' }),
      'phc_x',
    )
    expect(relayed?.headers.has('cookie')).toBe(false)
    expect(relayed?.headers.get('content-type')).toBe('text/plain')
  })
})

describe('the locale proxy', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("relays analytics to PostHog with the visitor's address and no cookies", async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_x')
    vi.resetModules()
    const { default: proxy, config } = await import('@/proxy')
    const { NextRequest } = await import('next/server')
    expect(
      config.matcher.some((m) =>
        new RegExp(`^${m.replace(':path*', '.*')}$`).test(`${INGEST_PATH}/i/v0/e/`),
      ),
    ).toBe(true)
    const response = proxy(
      new NextRequest(`https://ci-las.test${INGEST_PATH}/i/v0/e/`, {
        method: 'POST',
        headers: { 'cf-connecting-ip': '156.215.195.207', cookie: 'payload-token=secret' },
      }),
    )
    expect(response.headers.get('x-middleware-rewrite')).toBe('https://eu.i.posthog.com/i/v0/e/')
    expect(response.headers.get('x-middleware-request-x-forwarded-for')).toBe('156.215.195.207')
    expect(response.headers.get('x-middleware-override-headers')?.split(',')).not.toContain(
      'cookie',
    )
  })
})
