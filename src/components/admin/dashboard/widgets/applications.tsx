import { BarChart } from '@/components/arc/bar-chart/bar-chart'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { bucketByDay, countBy, periodChange, thinAxis, totalOf } from '@/lib/admin-stats'

import { cachedStat } from '../cached'
import { WidgetCard } from '../widget-card'

type Application = { createdAt: string; status: string }

/**
 * Applications are form submissions that name a target; contact messages have
 * none (the same rule as the review queue, src/lib/review-queue.ts).
 */
const applications = () =>
  cachedStat<Application[]>('applications', async (payload) => {
    const { docs } = await payload.find({
      collection: 'form-submissions',
      select: { createdAt: true, status: true, target: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return docs
      .filter((s) => s.target?.value)
      .map((s) => ({ createdAt: s.createdAt, status: s.status ?? 'new' }))
  })

export async function OpenApplications() {
  const all = await applications()
  const stamps = all.map((a) => a.createdAt)
  const recent = totalOf(bucketByDay(stamps, 30))
  return (
    <MetricCard
      label="Open applications"
      value={all.filter((a) => a.status === 'new').length}
      context={`${recent} received in the last 30 days`}
      change={periodChange(stamps, 30) ?? undefined}
    />
  )
}

export async function ApplicationsPerDay() {
  const all = await applications()
  const points = thinAxis(
    bucketByDay(
      all.map((a) => a.createdAt),
      30,
    ),
    5,
  )
  return (
    <WidgetCard title="Applications per day">
      <BarChart
        data={points}
        label="Applications per day"
        period="Last 30 days"
        unit="applications"
        averageLabel="Daily average"
        categoryLabel="Day"
        showAverage
        height={180}
      />
    </WidgetCard>
  )
}

const OUTCOMES = [
  { key: 'new', label: 'New', color: 'var(--series-1)' },
  { key: 'accepted', label: 'Accepted', color: 'var(--success)' },
  { key: 'rejected', label: 'Rejected', color: 'var(--danger)' },
] as const

export async function ApplicationsByOutcome() {
  const all = await applications()
  const since = Date.now() - 90 * 86_400_000
  const counts = countBy(
    all.filter((a) => new Date(a.createdAt).getTime() >= since),
    (a) => a.status,
  )
  return (
    <WidgetCard title="Applications by outcome" description="Received in the last 90 days">
      <DonutChart
        data={OUTCOMES.map(({ key, label, color }) => ({
          key,
          label,
          color,
          value: counts[key] ?? 0,
        }))}
        label="Applications by outcome"
        unit="applications"
        totalLabel="Applications"
        size={160}
        thickness={18}
        emptyLabel="No data"
      />
    </WidgetCard>
  )
}
