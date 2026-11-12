import type { ReactNode } from 'react'
import type { Payload, PayloadRequest, TypedUser } from 'payload'

import { ReviewQueueWidget } from '@/components/admin/review-queue'

import { Isolated } from './isolated'
import { dashboardEntries, type WidgetSlug } from './native-widgets'
import { analyticsConfigured } from './posthog'
import { QuickActions } from './quick-actions'
import { AccountsByRole, NewAccounts } from './widgets/accounts'
import {
  ApplyFunnel,
  Audience,
  DailyActivity,
  FreePlanUsage,
  Goals,
  PageMovement,
  PageViews,
  SiteErrors,
  TopCoursesAndEvents,
  TopPages,
  TrafficOverTime,
  TrafficSources,
  Visitors,
  WebVitals,
} from './widgets/analytics'
import { ApplicationsByOutcome, ApplicationsPerDay, OpenApplications } from './widgets/applications'
import { ActiveSpaces, CommunityActivity } from './widgets/community'
import {
  ContentPipeline,
  PublishedCourses,
  RecentChanges,
  UpcomingEvents,
  UpcomingEventsCount,
} from './widgets/content'
import {
  EnrollmentsByStage,
  EnrollmentsInProgress,
  EnrollmentsOverTime,
} from './widgets/enrollments'
import { MediaStorage, NewsletterUsage } from './widgets/storage'

/**
 * The widgets, in the shape Payload's native dashboard renders: one server
 * component that gets `{ req, user, widgetSlug, ... }` and draws the widget
 * declared in native-widgets.ts. Each loads behind its own skeleton.
 */
type NativeProps = { req: PayloadRequest; user: TypedUser }

/** Each widget's content, by slug. The ones that need the signed-in admin read `req` and `user`. */
const RENDER: Record<WidgetSlug, (props: NativeProps) => Promise<ReactNode>> = {
  'quick-actions': async ({ req, user }) => (
    <QuickActions payload={req.payload as Payload} user={user} />
  ),
  'open-applications': OpenApplications,
  'enrollments-in-progress': EnrollmentsInProgress,
  'published-courses': PublishedCourses,
  'upcoming-events-count': UpcomingEventsCount,
  'applications-per-day': ApplicationsPerDay,
  'applications-by-outcome': ApplicationsByOutcome,
  'enrollments-by-stage': EnrollmentsByStage,
  'enrollments-over-time': EnrollmentsOverTime,
  'accounts-by-role': AccountsByRole,
  'new-accounts': NewAccounts,
  'community-activity': CommunityActivity,
  visitors: Visitors,
  'page-views': PageViews,
  'site-errors': SiteErrors,
  traffic: TrafficOverTime,
  'application-funnel': ApplyFunnel,
  'top-pages': TopPages,
  'page-movement': PageMovement,
  'traffic-sources': TrafficSources,
  audience: Audience,
  'visitor-goals': Goals,
  'courses-and-events': TopCoursesAndEvents,
  'web-vitals': WebVitals,
  'posthog-usage': FreePlanUsage,
  'daily-activity': DailyActivity,
  'media-storage': MediaStorage,
  'newsletter-usage': NewsletterUsage,
  'waiting-for-review': async ({ req, user }) =>
    ReviewQueueWidget({
      payload: req.payload as Payload,
      user,
      ar: req.i18n.language === 'ar',
    }),
  'upcoming-events': UpcomingEvents,
  'active-spaces': ActiveSpaces,
  'content-pipeline': ContentPipeline,
  'recent-changes': RecentChanges,
}

/**
 * PostHog widgets (`analytics`): nothing at all without the PostHog settings,
 * and "Could not load from PostHog" when PostHog is slow or fails.
 */
export function DashboardWidget({ req, user, widgetSlug }: NativeProps & { widgetSlug: string }) {
  const entry = dashboardEntries.find((candidate) => candidate.slug === widgetSlug)
  if (!entry || (entry.analytics && !analyticsConfigured())) return null
  const render = RENDER[entry.slug as WidgetSlug]
  return (
    <Isolated
      title={entry.title ?? entry.label}
      render={() => render({ req, user })}
      source={entry.analytics ? 'PostHog' : undefined}
    />
  )
}
