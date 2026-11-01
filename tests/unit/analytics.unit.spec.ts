import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { routing } from '@/i18n/routing'
import { isBotPath, isNoisyError } from '@/lib/analytics/errors'
import { posthogHosts, ingestRewrites } from '@/lib/analytics/hosts'
import {
  EXCLUDED_SECTIONS,
  TRACKED_SECTIONS,
  isTrackedPath,
  reportedPath,
  stripLocale,
} from '@/lib/analytics/paths'
import { gateCapture, mayCapture } from '@/lib/analytics/policy'
import { scrubReferrer, scrubText, scrubUrl } from '@/lib/analytics/scrub'
import { makeBeforeSend, makeRecordingSync, posthogConfig } from '@/lib/analytics/client'
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
    '/ingest/e/',
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
    expect(config.persistence).toBe('memory')
    expect(config.person_profiles).toBe('identified_only')
    expect(config.autocapture).toBe(false)
    expect(config.capture_pageleave).toBe(false)
    expect(config.capture_heatmaps).toBe(false)
    expect(config.advanced_disable_flags).toBe(true)
    expect(config.disable_surveys).toBe(true)
    expect(config.disable_session_recording).toBe(true)
    expect(config.respect_dnt).toBe(true)
  })

  it('goes through the site and masks the forms in recordings', () => {
    expect(config.api_host).toBe('/ingest')
    expect(config.session_recording).toMatchObject({ maskAllInputs: true })
    expect(config.session_recording?.maskTextSelector).toContain('form')
  })

  it('starts and stops the recorder as pages change', () => {
    const recorder = { startSessionRecording: vi.fn(), stopSessionRecording: vi.fn() }
    const sync = makeRecordingSync(recorder, true)
    sync('/en/about')
    sync('/en/articles')
    expect(recorder.startSessionRecording).toHaveBeenCalledTimes(1)
    sync('/en/spaces')
    expect(recorder.stopSessionRecording).toHaveBeenCalledTimes(1)
    sync('/en/login')
    expect(recorder.stopSessionRecording).toHaveBeenCalledTimes(1)
  })

  it('never records an unsampled visit', () => {
    const recorder = { startSessionRecording: vi.fn(), stopSessionRecording: vi.fn() }
    const sync = makeRecordingSync(recorder, false)
    sync('/en/about')
    expect(recorder.startSessionRecording).not.toHaveBeenCalled()
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

  it('forwards /ingest only when a key is set, assets first', () => {
    expect(ingestRewrites(undefined)).toEqual([])
    const rules = ingestRewrites('phc_x')
    expect(rules.map((r) => r.source)).toEqual([
      '/ingest/static/:path*',
      '/ingest/array/:path*',
      '/ingest/:path*',
    ])
    expect(rules[0]?.destination).toBe('https://eu-assets.i.posthog.com/static/:path*')
    expect(rules[2]?.destination).toBe('https://eu.i.posthog.com/:path*')
  })
})
