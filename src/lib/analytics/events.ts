/**
 * The events the site sends, and what each may carry. A property is a short
 * public label (a slug, a kind), never text a person typed. To add an event,
 * add a line here, call `track` where it happens and list it in
 * docs/analytics.md.
 */
export type AnalyticsEvents = {
  apply_started: { kind: 'course' | 'programme'; id: string }
  apply_submitted: { kind: 'course' | 'programme'; id: string }
  register_clicked: { kind: 'event'; id: string }
  calendar_added: { source: 'event-google' | 'event-ics' | 'feed-subscribe' | 'feed-download' }
  newsletter_subscribed: { place: 'footer' | 'article' | 'page' }
  push_enabled: Record<string, never>
  login: { method: 'password' | 'google' }
  contact_submitted: { topic?: string }
}

export type AnalyticsEvent = keyof AnalyticsEvents

/**
 * Events that fire where analytics is otherwise off (the login page, the
 * settings page). They carry no address and no page, so they say only that
 * something happened.
 */
export const ANYWHERE_EVENTS: ReadonlySet<string> = new Set<AnalyticsEvent>([
  'login',
  'push_enabled',
])
