import type { Widget, WidgetInstance, WidgetWidth } from 'payload'

import { queryConfig } from '@/lib/analytics/posthog-query'

/**
 * The dashboard's widgets for Payload's native modular dashboard
 * (`admin.dashboard`, experimental in 3.91): admins drag, resize, add and
 * remove them, and the layout is saved per account. Components live in
 * ./native.tsx.
 */
const PATH = '/components/admin/dashboard/native'

type Entry = {
  slug: string
  label: string
  component: string
  /** Width in the default layout. */
  width: WidgetWidth
  min?: WidgetWidth
  max?: WidgetWidth
  /** Needs PostHog: in the default layout only when the PostHog settings are there. */
  analytics?: boolean
}

/**
 * In default layout order: quick actions, key numbers, trends, site analytics
 * (when PostHog is set up), then lists. The analytics widgets are always
 * registered, so a saved layout keeps them, but they draw nothing without PostHog.
 */
const ENTRIES: Entry[] = [
  { slug: 'quick-actions', label: 'Quick actions', component: 'QuickActionsWidget', width: 'full' },
  {
    slug: 'open-applications',
    label: 'Open applications',
    component: 'OpenApplicationsWidget',
    width: 'x-small',
  },
  {
    slug: 'enrollments-in-progress',
    label: 'Enrollments in progress',
    component: 'EnrollmentsInProgressWidget',
    width: 'x-small',
  },
  {
    slug: 'published-courses',
    label: 'Published courses',
    component: 'PublishedCoursesWidget',
    width: 'x-small',
  },
  {
    slug: 'upcoming-events-count',
    label: 'Upcoming events (count)',
    component: 'UpcomingEventsCountWidget',
    width: 'x-small',
  },
  {
    slug: 'applications-per-day',
    label: 'Applications per day',
    component: 'ApplicationsPerDayWidget',
    width: 'medium',
  },
  {
    slug: 'applications-by-outcome',
    label: 'Applications by outcome',
    component: 'ApplicationsByOutcomeWidget',
    width: 'x-small',
  },
  {
    slug: 'enrollments-by-stage',
    label: 'Enrollments by stage',
    component: 'EnrollmentsByStageWidget',
    width: 'x-small',
  },
  {
    slug: 'enrollments-over-time',
    label: 'Enrollments over time',
    component: 'EnrollmentsOverTimeWidget',
    width: 'medium',
  },
  {
    slug: 'accounts-by-role',
    label: 'Accounts by role',
    component: 'AccountsByRoleWidget',
    width: 'x-small',
  },
  { slug: 'new-accounts', label: 'New accounts', component: 'NewAccountsWidget', width: 'x-small' },
  {
    slug: 'community-activity',
    label: 'Community activity',
    component: 'CommunityActivityWidget',
    width: 'medium',
  },
  {
    slug: 'visitors',
    label: 'Visitors',
    component: 'VisitorsWidget',
    width: 'x-small',
    analytics: true,
  },
  {
    slug: 'page-views',
    label: 'Page views',
    component: 'PageViewsWidget',
    width: 'x-small',
    analytics: true,
  },
  {
    slug: 'site-errors',
    label: 'Site errors',
    component: 'SiteErrorsWidget',
    width: 'x-small',
    analytics: true,
  },
  {
    slug: 'posthog-usage',
    label: 'PostHog free plan',
    component: 'FreePlanUsageWidget',
    width: 'x-small',
    analytics: true,
  },
  {
    slug: 'traffic',
    label: 'Traffic',
    component: 'TrafficWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'application-funnel',
    label: 'Application funnel',
    component: 'ApplyFunnelWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'top-pages',
    label: 'Top pages',
    component: 'TopPagesWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'page-movement',
    label: 'Page movement',
    component: 'PageMovementWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'traffic-sources',
    label: 'Where visitors come from',
    component: 'TrafficSourcesWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'audience',
    label: 'Audience',
    component: 'AudienceWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'visitor-goals',
    label: 'What visitors do',
    component: 'GoalsWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'courses-and-events',
    label: 'Courses and events',
    component: 'CoursesAndEventsWidget',
    width: 'medium',
    analytics: true,
  },
  {
    slug: 'daily-activity',
    label: 'Daily activity',
    component: 'DailyActivityWidget',
    width: 'full',
    analytics: true,
  },
  {
    slug: 'media-storage',
    label: 'Media library',
    component: 'MediaStorageWidget',
    width: 'x-small',
  },
  {
    slug: 'newsletter-usage',
    label: 'Newsletter contacts',
    component: 'NewsletterUsageWidget',
    width: 'x-small',
  },
  {
    slug: 'waiting-for-review',
    label: 'Waiting for review',
    component: 'WaitingForReviewWidget',
    width: 'full',
  },
  {
    slug: 'upcoming-events',
    label: 'Upcoming events',
    component: 'UpcomingEventsWidget',
    width: 'medium',
  },
  {
    slug: 'active-spaces',
    label: 'Active spaces',
    component: 'ActiveSpacesWidget',
    width: 'medium',
  },
  {
    slug: 'content-pipeline',
    label: 'Content pipeline',
    component: 'ContentPipelineWidget',
    width: 'medium',
  },
  {
    slug: 'recent-changes',
    label: 'Recent changes',
    component: 'RecentChangesWidget',
    width: 'medium',
  },
]

export const dashboardWidgets: Widget[] = ENTRIES.map(({ slug, label, component, min, max }) => ({
  slug,
  label,
  Component: `${PATH}#${component}`,
  minWidth: min ?? 'x-small',
  maxWidth: max ?? 'full',
}))

// The generated WidgetInstance type is a union over each registered slug, which
// a list built from ENTRIES cannot narrow to.
export const defaultLayout = ENTRIES.filter(
  ({ analytics }) => !analytics || queryConfig() !== null,
).map(({ slug, width }) => ({
  widgetSlug: slug,
  width,
})) as WidgetInstance[]
