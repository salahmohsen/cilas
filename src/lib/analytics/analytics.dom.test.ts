import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'

import { makeBeforeSend } from '@/lib/analytics/client'
import { setSender, track } from '@/lib/analytics/track'

describe('the browser error filter', () => {
  it('sends one of a repeated browser error, and caps a page at five', () => {
    const send = makeBeforeSend()
    window.history.replaceState(null, '', '/en/about')
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
  })
})

describe('track', () => {
  const sent = vi.fn()
  beforeEach(() => {
    sent.mockReset()
    window.history.replaceState(null, '', '/en/events/open-day')
  })
  afterEach(() => {
    setSender(null)
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
    window.history.replaceState(null, '', '/en/spaces')
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
