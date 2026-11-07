import type { Widget, WidgetInstance, WidgetWidth } from 'payload'

import { queryConfig } from '@/lib/analytics/posthog-query'

/**
 * The dashboard's widgets for Payload's native modular dashboard
 * (`admin.dashboard`, experimental in 3.91): admins drag, resize, add and
 * remove them, and the layout is saved per account. They render in
 * ./native.tsx.
 */
const PATH = '/components/admin/dashboard/native#DashboardWidget'

type Entry = {
  slug: string
  /** The name in the add-widget picker. */
  label: string
  /** The name on the widget's skeleton and error card, when it differs from `label`. */
  title?: string
  /** Width in the default layout. */
  width: WidgetWidth
  /** Needs PostHog: in the default layout only when the PostHog settings are there. */
  analytics?: boolean
}

/**
 * The one list of widgets: this file builds Payload's config from it and
 * native.tsx renders from it, one renderer per slug. In default layout order:
 * quick actions, key numbers, trends, site analytics (when PostHog is set up),
 * then lists. The analytics widgets are always registered, so a saved layout
 * keeps them, but they draw nothing without PostHog.
 */
const ENTRIES = [
  { slug: 'quick-actions', label: 'Quick actions', width: 'full' },
  { slug: 'open-applications', label: 'Open applications', width: 'x-small' },
  { slug: 'enrollments-in-progress', label: 'Enrollments in progress', width: 'x-small' },
  { slug: 'published-courses', label: 'Published courses', width: 'x-small' },
  {
    slug: 'upcoming-events-count',
    label: 'Upcoming events (count)',
    title: 'Upcoming events',
    width: 'x-small',
  },
  { slug: 'applications-per-day', label: 'Applications per day', width: 'medium' },
  { slug: 'applications-by-outcome', label: 'Applications by outcome', width: 'x-small' },
  { slug: 'enrollments-by-stage', label: 'Enrollments by stage', width: 'x-small' },
  { slug: 'enrollments-over-time', label: 'Enrollments over time', width: 'medium' },
  { slug: 'accounts-by-role', label: 'Accounts by role', width: 'x-small' },
  { slug: 'new-accounts', label: 'New accounts', width: 'x-small' },
  { slug: 'community-activity', label: 'Community activity', width: 'medium' },
  { slug: 'visitors', label: 'Visitors', width: 'x-small', analytics: true },
  { slug: 'page-views', label: 'Page views', width: 'x-small', analytics: true },
  { slug: 'site-errors', label: 'Site errors', width: 'x-small', analytics: true },
  { slug: 'traffic', label: 'Traffic', width: 'x-large', analytics: true },
  { slug: 'application-funnel', label: 'Application funnel', width: 'medium', analytics: true },
  { slug: 'top-pages', label: 'Top pages', width: 'medium', analytics: true },
  { slug: 'page-movement', label: 'Page movement', width: 'medium', analytics: true },
  { slug: 'traffic-sources', label: 'Where visitors come from', width: 'medium', analytics: true },
  { slug: 'audience', label: 'Audience', width: 'medium', analytics: true },
  { slug: 'visitor-goals', label: 'What visitors do', width: 'medium', analytics: true },
  { slug: 'courses-and-events', label: 'Courses and events', width: 'medium', analytics: true },
  { slug: 'posthog-usage', label: 'PostHog free plan', width: 'medium', analytics: true },
  { slug: 'daily-activity', label: 'Daily activity', width: 'full', analytics: true },
  { slug: 'media-storage', label: 'Media library', width: 'x-small' },
  { slug: 'newsletter-usage', label: 'Newsletter contacts', width: 'x-small' },
  { slug: 'waiting-for-review', label: 'Waiting for review', width: 'full' },
  { slug: 'upcoming-events', label: 'Upcoming events', width: 'medium' },
  { slug: 'active-spaces', label: 'Active spaces', width: 'medium' },
  { slug: 'content-pipeline', label: 'Content pipeline', width: 'medium' },
  { slug: 'recent-changes', label: 'Recent changes', width: 'medium' },
] as const satisfies readonly Entry[]

export type WidgetSlug = (typeof ENTRIES)[number]['slug']
export const dashboardEntries: readonly Entry[] = ENTRIES

export const dashboardWidgets: Widget[] = ENTRIES.map(({ slug, label }) => ({
  slug,
  label,
  // One component serves every slug: Payload passes `widgetSlug` to it.
  Component: PATH,
  minWidth: 'x-small',
  maxWidth: 'full',
}))

// The generated WidgetInstance type is a union over each registered slug, which
// a list built from ENTRIES cannot narrow to.
export const defaultLayout = ENTRIES.filter(
  (entry) => !('analytics' in entry) || queryConfig() !== null,
).map(({ slug, width }) => ({
  widgetSlug: slug,
  width,
})) as WidgetInstance[]
