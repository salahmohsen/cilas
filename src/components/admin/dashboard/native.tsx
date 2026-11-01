import type { ReactNode } from 'react'
import type { Payload, PayloadRequest, TypedUser } from 'payload'

import { ReviewQueueWidget } from '@/components/admin/review-queue'

import { Isolated } from './isolated'
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
 * The widgets, in the shape Payload's native dashboard renders: server
 * components that get `{ req, user, widgetData, ... }` (config in
 * native-widgets.ts). Each loads behind its own skeleton.
 */
type NativeProps = { req: PayloadRequest; user: TypedUser }

const widget = (title: string, render: () => Promise<ReactNode>) =>
  function NativeWidget() {
    return <Isolated title={title} render={render} />
  }

/**
 * PostHog widgets: nothing at all without the PostHog settings, and nothing
 * (rather than an error card) when PostHog is slow or fails.
 */
const analyticsWidget = (title: string, render: () => Promise<ReactNode>) =>
  function AnalyticsWidget() {
    if (!analyticsConfigured()) return null
    return <Isolated title={title} render={render} quiet />
  }

export const OpenApplicationsWidget = widget('Open applications', OpenApplications)
export const EnrollmentsInProgressWidget = widget('Enrollments in progress', EnrollmentsInProgress)
export const PublishedCoursesWidget = widget('Published courses', PublishedCourses)
export const UpcomingEventsCountWidget = widget('Upcoming events', UpcomingEventsCount)
export const ApplicationsPerDayWidget = widget('Applications per day', ApplicationsPerDay)
export const ApplicationsByOutcomeWidget = widget('Applications by outcome', ApplicationsByOutcome)
export const EnrollmentsByStageWidget = widget('Enrollments by stage', EnrollmentsByStage)
export const EnrollmentsOverTimeWidget = widget('Enrollments over time', EnrollmentsOverTime)
export const AccountsByRoleWidget = widget('Accounts by role', AccountsByRole)
export const NewAccountsWidget = widget('New accounts', NewAccounts)
export const CommunityActivityWidget = widget('Community activity', CommunityActivity)
export const MediaStorageWidget = widget('Media library', MediaStorage)
export const NewsletterUsageWidget = widget('Newsletter contacts', NewsletterUsage)
export const UpcomingEventsWidget = widget('Upcoming events', UpcomingEvents)
export const ActiveSpacesWidget = widget('Active spaces', ActiveSpaces)
export const ContentPipelineWidget = widget('Content pipeline', ContentPipeline)
export const RecentChangesWidget = widget('Recent changes', RecentChanges)

/** The widgets that need the signed-in admin (the others read through the cache). */
export function QuickActionsWidget({ req, user }: NativeProps) {
  return (
    <Isolated
      title="Quick actions"
      render={async () => <QuickActions payload={req.payload as Payload} user={user} />}
    />
  )
}

export function WaitingForReviewWidget({ req, user }: NativeProps) {
  return (
    <Isolated
      title="Waiting for review"
      render={() => ReviewQueueWidget({ payload: req.payload as Payload, user })}
    />
  )
}

export const VisitorsWidget = analyticsWidget('Visitors', Visitors)
export const PageViewsWidget = analyticsWidget('Page views', PageViews)
export const SiteErrorsWidget = analyticsWidget('Site errors', SiteErrors)
export const TrafficWidget = analyticsWidget('Traffic', TrafficOverTime)
export const DailyActivityWidget = analyticsWidget('Daily activity', DailyActivity)
export const TopPagesWidget = analyticsWidget('Top pages', TopPages)
export const PageMovementWidget = analyticsWidget('Page movement', PageMovement)
export const TrafficSourcesWidget = analyticsWidget('Where visitors come from', TrafficSources)
export const AudienceWidget = analyticsWidget('Audience', Audience)
export const ApplyFunnelWidget = analyticsWidget('Application funnel', ApplyFunnel)
export const GoalsWidget = analyticsWidget('What visitors do', Goals)
export const CoursesAndEventsWidget = analyticsWidget('Courses and events', TopCoursesAndEvents)
export const FreePlanUsageWidget = analyticsWidget('PostHog free plan', FreePlanUsage)
