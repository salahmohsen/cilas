import type { DashboardViewServerProps } from '@payloadcms/next/views'
import { Gutter } from '@payloadcms/ui'
import { Dashboard } from 'payload-theme/rsc'

import { isAdminUser } from '@/access'
import { ReviewQueueWidget } from '@/components/admin/review-queue'

import './arc-scope.css'
import styles from './dashboard.module.css'
import { QuickActions } from './quick-actions'
import { Slot } from './slot'
import { AccountsByRole, NewAccounts } from './widgets/accounts'
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
 * The admin home. Admins get the statistics; everyone else keeps the theme's
 * own cards. Custom views skip Payload's access rules, so the role check
 * happens here, before any widget reads with `overrideAccess`.
 */
export async function DashboardView(props: DashboardViewServerProps) {
  const { payload, user } = props.initPageResult.req
  if (!user || !isAdminUser(user)) return <Dashboard {...props} />

  return (
    <Gutter>
      <div className={`arc-scope ${styles.page}`}>
        <h1 className={styles.title}>Dashboard</h1>

        <section className={styles.section} aria-label="Quick actions">
          <QuickActions payload={payload} user={user} />
        </section>

        <section className={styles.section} aria-labelledby="dash-numbers">
          <h2 id="dash-numbers" className={styles.sectionTitle}>
            Key numbers
          </h2>
          <div className={styles.grid}>
            <Slot title="Open applications" render={OpenApplications} />
            <Slot title="Enrollments in progress" render={EnrollmentsInProgress} />
            <Slot title="Published courses" render={PublishedCourses} />
            <Slot title="Upcoming events" render={UpcomingEventsCount} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="dash-trends">
          <h2 id="dash-trends" className={styles.sectionTitle}>
            Trends
          </h2>
          <div className={styles.grid}>
            <Slot title="Applications per day" span={2} render={ApplicationsPerDay} />
            <Slot title="Applications by outcome" render={ApplicationsByOutcome} />
            <Slot title="Enrollments by stage" render={EnrollmentsByStage} />
            <Slot title="Enrollments over time" span={2} render={EnrollmentsOverTime} />
            <Slot title="Accounts by role" render={AccountsByRole} />
            <Slot title="New accounts" render={NewAccounts} />
            <Slot title="Community activity" span={2} render={CommunityActivity} />
            <Slot title="Media library" render={MediaStorage} />
            <Slot title="Newsletter contacts" render={NewsletterUsage} />
          </div>
        </section>

        <section className={styles.section} aria-labelledby="dash-lists">
          <h2 id="dash-lists" className={styles.sectionTitle}>
            Lists
          </h2>
          <div className={styles.grid}>
            <Slot
              title="Waiting for review"
              span={4}
              render={() => ReviewQueueWidget({ payload, user })}
            />
            <Slot title="Upcoming events" span={2} render={UpcomingEvents} />
            <Slot title="Active spaces" span={2} render={ActiveSpaces} />
            <Slot title="Content pipeline" span={2} render={ContentPipeline} />
            <Slot title="Recent changes" span={2} render={RecentChanges} />
          </div>
        </section>
      </div>
    </Gutter>
  )
}
