import { track } from '@/lib/analytics/track'
import type { AnalyticsEvents } from '@/lib/analytics/events'

export const subscribeToNewsletter = async (
  email: string,
  place: AnalyticsEvents['newsletter_subscribed']['place'] = 'page',
) => {
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Subscribe failed')
  // Only that someone subscribed, and from where: never the address.
  track('newsletter_subscribed', { place })
}
