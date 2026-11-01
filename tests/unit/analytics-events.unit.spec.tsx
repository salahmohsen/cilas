import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RegisterLink } from '@/components/events/register-link'
import { setSender } from '@/lib/analytics/track'
import { subscribeToNewsletter } from '@/lib/newsletter-subscribe'

const sent = vi.fn()

beforeEach(() => {
  sent.mockReset()
  setSender(sent)
  window.history.pushState({}, '', '/en/events/open-day')
})
afterEach(() => {
  cleanup()
  setSender(null)
  vi.unstubAllGlobals()
})

describe('newsletter_subscribed', () => {
  it('is sent after a good signup, with the place and never the address', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    await subscribeToNewsletter('reader@example.org', 'footer')
    expect(sent).toHaveBeenCalledExactlyOnceWith('newsletter_subscribed', { place: 'footer' })
    expect(JSON.stringify(sent.mock.calls)).not.toContain('reader@example.org')
  })

  it('is not sent when the signup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'No' }) }),
    )
    await expect(subscribeToNewsletter('reader@example.org')).rejects.toThrow('No')
    expect(sent).not.toHaveBeenCalled()
  })
})

describe('register_clicked', () => {
  it('is sent with the event slug when the link is clicked', () => {
    render(
      <RegisterLink href="#event-registration" slug="open-day">
        Register
      </RegisterLink>,
    )
    fireEvent.click(screen.getByRole('link', { name: 'Register' }))
    expect(sent).toHaveBeenCalledExactlyOnceWith('register_clicked', {
      kind: 'event',
      id: 'open-day',
    })
  })
})
