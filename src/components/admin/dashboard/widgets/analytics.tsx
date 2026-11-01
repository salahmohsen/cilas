import { ActivityHeatmap } from '@/components/arc/activity-heatmap/activity-heatmap'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { LineChart } from '@/components/arc/line-chart/line-chart'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { Progress } from '@/components/arc/progress/progress'
import { SlopeChart } from '@/components/arc/slope-chart/slope-chart'
import { Sparkline } from '@/components/arc/sparkline/sparkline'
import { UsageMeter } from '@/components/arc/usage-meter/usage-meter'
import { WaffleChart } from '@/components/arc/waffle-chart/waffle-chart'
import { thinAxis } from '@/lib/admin-stats'
import {
  activityFrom,
  deviceSplit,
  errorsFrom,
  funnelFrom,
  goalsFrom,
  languageSplit,
  pageMovement,
  topCountries,
  topCourses,
  topEvents,
  topPages,
  topReferrers,
  totalViewsOf,
  trafficFrom,
  usageFrom,
  withOther,
  type Ranked,
} from '@/lib/analytics/stats'
import { env } from '@/env'

import styles from '../dashboard.module.css'
import { posthogLink, posthogRows } from '../posthog'
import { WidgetCard } from '../widget-card'

const number = new Intl.NumberFormat('en-US')

const PERIOD = 'Last 30 days'
const VISITOR_NOTE =
  'Each page load counts as a visitor: the site keeps no cookie to tell people apart.'

const openIn = (path: string, label = 'Open in PostHog') => {
  const href = posthogLink(path)
  return href ? (
    <a className={styles.cardLink} href={href} rel="noopener noreferrer" target="_blank">
      {label}
    </a>
  ) : undefined
}

/** Names with a bar for their share of `total`, and the count beside it. */
function RankedList({ items, total, unit }: { items: Ranked[]; total: number; unit: string }) {
  if (items.length === 0) {
    return <EmptyState title="Nothing yet" description={`No ${unit} in the last 30 days.`} />
  }
  return (
    <ul className={styles.ranked}>
      {items.map((item) => (
        <li key={item.key} className={styles.rankedRow}>
          <Progress label={item.label} max={Math.max(total, 1)} showValue value={item.value} />
          <span className={styles.rankedCount}>{number.format(item.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/* Traffic */

export async function Visitors() {
  const traffic = trafficFrom(await posthogRows('daily'))
  return (
    <WidgetCard title="Visitors" description={PERIOD}>
      <Sparkline
        area
        change={traffic.visitorsChange ?? undefined}
        data={traffic.visitors.map((p) => p.value)}
        interactive
        label="Visitors a day"
        labels={traffic.visitors.map((p) => p.label)}
        value={number.format(traffic.visitorsTotal)}
      />
    </WidgetCard>
  )
}

export async function PageViews() {
  const traffic = trafficFrom(await posthogRows('daily'))
  return (
    <WidgetCard title="Page views" description={PERIOD}>
      <Sparkline
        area
        change={traffic.viewsChange ?? undefined}
        data={traffic.views.map((p) => p.value)}
        interactive
        label="Page views a day"
        labels={traffic.views.map((p) => p.label)}
        value={number.format(traffic.viewsTotal)}
      />
    </WidgetCard>
  )
}

export async function TrafficOverTime() {
  const traffic = trafficFrom(await posthogRows('daily'))
  const axis = thinAxis(traffic.views, 5)
  return (
    <WidgetCard title="Traffic" description={`${PERIOD}. ${VISITOR_NOTE}`}>
      <LineChart
        categoryLabel="Day"
        data={axis.map((point, i) => ({
          key: point.key,
          label: point.label,
          axisLabel: point.axisLabel,
          values: { views: point.value, visitors: traffic.visitors[i]?.value ?? 0 },
        }))}
        emptyLabel="No visits in the last 30 days"
        height={200}
        label="Page views and visitors per day"
        series={[
          { key: 'views', label: 'Page views', color: 'var(--series-1)' },
          { key: 'visitors', label: 'Visitors', color: 'var(--series-2)' },
        ]}
        unit="visits"
      />
    </WidgetCard>
  )
}

export async function DailyActivity() {
  const days = activityFrom(await posthogRows('daily'))
  return (
    <WidgetCard title="Daily activity" description="Page views, one square a day">
      <ActivityHeatmap
        days={days}
        label="Page views per day over the last year"
        period="the last year"
        unit={{ one: 'page view', other: 'page views' }}
        weekStartsOn={0}
      />
    </WidgetCard>
  )
}

/* Pages */

export async function TopPages() {
  const rows = await posthogRows('pages')
  return (
    <WidgetCard
      title="Top pages"
      description={`${PERIOD}, English and Arabic together`}
      action={openIn('web')}
    >
      <RankedList items={topPages(rows)} total={totalViewsOf(rows)} unit="page views" />
    </WidgetCard>
  )
}

export async function PageMovement() {
  const movement = pageMovement(await posthogRows('pages'))
  return (
    <WidgetCard
      title="Page movement"
      description="The busiest pages now against the 30 days before"
    >
      {movement.length < 2 ? (
        <EmptyState title="Not enough yet" description="Needs page views in both periods." />
      ) : (
        <SlopeChart
          data={movement}
          endLabel="Last 30 days"
          formatValue={(value) => number.format(value)}
          highlightKey={movement[0]?.key}
          label="Page views per page"
          startLabel="Before"
        />
      )}
    </WidgetCard>
  )
}

export async function TopCoursesAndEvents() {
  const rows = await posthogRows('pages')
  const courses = topCourses(rows)
  const events = topEvents(rows)
  const total = totalViewsOf(rows)
  return (
    <WidgetCard title="Courses and events" description={`${PERIOD}, by page views`}>
      <div className={styles.pair}>
        <div>
          <h3 className={styles.subhead}>Courses</h3>
          <RankedList items={courses} total={total} unit="course views" />
        </div>
        <div>
          <h3 className={styles.subhead}>Events</h3>
          <RankedList items={events} total={total} unit="event views" />
        </div>
      </div>
    </WidgetCard>
  )
}

/* Sources and audience */

export async function TrafficSources() {
  const sources = withOther(topReferrers(await posthogRows('referrers'), ownHosts()), 5)
  return (
    <WidgetCard
      title="Where visitors come from"
      description={`${PERIOD}. Campaign tags (utm_source) count as the source.`}
    >
      {sources.length === 0 ? (
        <EmptyState
          title="Nothing yet"
          description="No visits from other sites in the last 30 days."
        />
      ) : (
        <WaffleChart data={sources} label="Visitors by source" unit="visitors" />
      )}
    </WidgetCard>
  )
}

export async function Audience() {
  const [pages, devices, countries] = await Promise.all([
    posthogRows('pages'),
    posthogRows('devices'),
    posthogRows('countries'),
  ])
  const donut = (items: Ranked[], label: string, total: string) => (
    <DonutChart
      data={items.map(({ key, label: name, value }, i) => ({
        key,
        label: name,
        value,
        color: `var(--series-${(i % 4) + 1})`,
      }))}
      emptyLabel="No data"
      label={label}
      size={140}
      thickness={16}
      totalLabel={total}
      unit="visits"
    />
  )
  return (
    <WidgetCard title="Audience" description={PERIOD}>
      <div className={styles.pair}>
        <div>
          <h3 className={styles.subhead}>Language</h3>
          {donut(languageSplit(pages), 'Page views by language', 'Page views')}
        </div>
        <div>
          <h3 className={styles.subhead}>Device</h3>
          {donut(deviceSplit(devices), 'Visitors by device', 'Visitors')}
        </div>
        <div>
          <h3 className={styles.subhead}>Country</h3>
          <RankedList
            items={topCountries(countries)}
            total={countries.reduce((sum, row) => sum + Number(row[1] ?? 0), 0)}
            unit="visitors"
          />
        </div>
      </div>
    </WidgetCard>
  )
}

/** The site's own address, so visits from inside it are not "referrers". */
const ownHosts = (): string[] => {
  try {
    return [new URL(env.NEXT_PUBLIC_SERVER_URL).hostname]
  } catch {
    return []
  }
}

/* Goals */

export async function ApplyFunnel() {
  const steps = funnelFrom(await posthogRows('funnel'))
  const first = steps[0]?.visitors ?? 0
  return (
    <WidgetCard
      title="Application funnel"
      description={`${PERIOD}. Share of the visitors who opened an application page.`}
    >
      {first === 0 ? (
        <EmptyState
          title="No applications viewed"
          description="Visitors to a course's apply page appear here."
        />
      ) : (
        <ul className={styles.ranked}>
          {steps.map((step) => (
            <li key={step.key} className={styles.rankedRow}>
              <Progress label={step.label} max={first} showValue value={step.visitors} />
              <span className={styles.rankedCount}>{number.format(step.visitors)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

export async function Goals() {
  const goals = goalsFrom(await posthogRows('goals'))
  return (
    <WidgetCard title="What visitors do" description={`${PERIOD}, against the 30 days before`}>
      <ul className={styles.list}>
        {goals.map((goal) => (
          <li key={goal.key} className={styles.row}>
            <span className={styles.rowMain}>{goal.label}</span>
            <span className={styles.rowMeta}>
              {number.format(goal.current)}
              {goal.change ? ` (${goal.change})` : ''}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  )
}

/* Health */

export async function SiteErrors() {
  const errors = errorsFrom(await posthogRows('errors'))
  return (
    <MetricCard
      change={errors.change ?? undefined}
      context="browser and server errors, last 7 days"
      label="Site errors"
      value={errors.last7}
    />
  )
}

export async function FreePlanUsage() {
  const [usage, recordings] = await Promise.all([
    posthogRows('usage'),
    posthogRows('recordings').catch(() => null),
  ])
  return (
    <WidgetCard
      title="PostHog free plan"
      description="This month, against the free allowance. Nothing is billed."
      action={openIn('settings/organization-billing', 'Billing')}
    >
      <div className={styles.meters}>
        {usageFrom(usage, recordings).map((meter) => (
          <UsageMeter
            key={meter.key}
            label={meter.label}
            limit={meter.limit}
            segments={[{ id: meter.key, label: 'Used', value: meter.used }]}
            unit={meter.key}
          />
        ))}
      </div>
    </WidgetCard>
  )
}
