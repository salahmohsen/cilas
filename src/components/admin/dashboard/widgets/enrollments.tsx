import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { LineChart } from '@/components/arc/line-chart/line-chart'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { bucketByWeek, countBy, periodChange } from '@/lib/admin-stats'
import type { Enrollment } from '@/payload-types'

import { cachedStat } from '../cached'
import { WidgetCard } from '../widget-card'

type Row = { createdAt: string; status: Enrollment['status'] }

const enrollments = () =>
  cachedStat<Row[]>('enrollments', async (payload) => {
    const { docs } = await payload.find({
      collection: 'enrollments',
      select: { createdAt: true, status: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return docs.map(({ createdAt, status }) => ({ createdAt, status }))
  })

const IN_PROGRESS: Row['status'][] = ['applied', 'accepted', 'confirmed']
const FINISHED: Row['status'][] = ['confirmed', 'completed']

export async function EnrollmentsInProgress() {
  const all = await enrollments()
  const stamps = all.map((e) => e.createdAt)
  return (
    <MetricCard
      label="Enrollments in progress"
      value={all.filter((e) => IN_PROGRESS.includes(e.status)).length}
      context={`${all.filter((e) => e.status === 'completed').length} completed so far`}
      change={periodChange(stamps, 30) ?? undefined}
    />
  )
}

const STAGES = [
  { key: 'applied', label: 'Applied', color: 'var(--series-1)' },
  { key: 'accepted', label: 'Accepted', color: 'var(--series-2)' },
  { key: 'confirmed', label: 'Confirmed', color: 'var(--series-3)' },
  { key: 'completed', label: 'Completed', color: 'var(--series-4)' },
  { key: 'withdrawn', label: 'Withdrawn', color: 'var(--danger)' },
] as const satisfies readonly { key: Row['status']; label: string; color: string }[]

export async function EnrollmentsByStage() {
  const counts = countBy(await enrollments(), (e) => e.status)
  return (
    <WidgetCard title="Enrollments by stage">
      <DonutChart
        data={STAGES.map(({ key, label, color }) => ({
          key,
          label,
          color,
          value: counts[key] ?? 0,
        }))}
        label="Enrollments by stage"
        unit="enrollments"
        totalLabel="Enrollments"
        size={160}
        thickness={18}
        emptyLabel="No enrollments yet"
      />
    </WidgetCard>
  )
}

export async function EnrollmentsOverTime() {
  const all = await enrollments()
  const started = bucketByWeek(
    all.map((e) => e.createdAt),
    12,
  )
  const finished = bucketByWeek(
    all.filter((e) => FINISHED.includes(e.status)).map((e) => e.createdAt),
    12,
  )
  return (
    <WidgetCard
      title="Enrollments over time"
      description="Each week shows the enrollments created in it"
    >
      <LineChart
        data={started.map((point, i) => ({
          key: point.key,
          label: point.label,
          axisLabel: point.axisLabel,
          values: { started: point.value, finished: finished[i]?.value ?? 0 },
        }))}
        series={[
          { key: 'started', label: 'Started', color: 'var(--series-1)' },
          { key: 'finished', label: 'Confirmed or completed', color: 'var(--success)' },
        ]}
        label="Enrollments per week"
        unit="enrollments"
        categoryLabel="Week"
        emptyLabel="No enrollments in the last 12 weeks"
        height={200}
      />
    </WidgetCard>
  )
}
