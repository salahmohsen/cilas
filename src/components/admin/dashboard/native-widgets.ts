import type { Widget, WidgetInstance, WidgetWidth } from 'payload'

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
}

/** In default layout order: quick actions, key numbers, trends, then lists. */
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
export const defaultLayout = ENTRIES.map(({ slug, width }) => ({
  widgetSlug: slug,
  width,
})) as WidgetInstance[]
