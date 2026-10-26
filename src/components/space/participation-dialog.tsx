'use client'

import { useFormatter, useTranslations } from 'next-intl'

import { BarChart } from '@/components/arc/bar-chart/bar-chart'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table'
import type { Participation } from '@/lib/spaces-data'

import styles from './space.module.css'

/**
 * Moderators only (spec §13): members never see each other's numbers. A dialog,
 * not a drawer, so the table has the width its five columns need.
 */
export function ParticipationDialog({
  data,
  now,
  open,
  onOpenChange,
}: {
  data: Participation
  now: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslations('Participation')
  const ts = useTranslations('Spaces')
  const format = useFormatter()
  const { rows, weeks } = data

  const wrote = rows.filter((r) => r.posts + r.comments > 0).length
  const never = rows.filter((r) => !r.lastVisit && r.posts + r.comments + r.reactions === 0).length
  const posts = rows.reduce((n, r) => n + r.posts, 0)
  const comments = rows.reduce((n, r) => n + r.comments, 0)

  const day = (iso: string) => format.dateTime(new Date(iso), { day: 'numeric', month: 'short' })
  const first = weeks[0]?.start
  const period = first ? t('since', { date: day(first) }) : ''

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title={t('title')}
        description={t('description')}
        className={styles.wideDialog}
      >
        <div className={styles.column}>
          <div className={styles.kpis}>
            <MetricCard label={ts('members')} value={rows.length} context={ts('kpiContext')} />
            <MetricCard label={ts('neverVisited')} value={never} context={ts('kpiContext')} />
            <MetricCard label={t('posts')} value={posts} context={ts('kpiContext')} />
            <MetricCard label={t('comments')} value={comments} context={ts('kpiContext')} />
          </div>
          <div className={styles.charts}>
            <section className={styles.chartBox}>
              <BarChart
                data={weeks.map((w) => ({
                  key: w.start,
                  label: t('weekOf', { date: day(w.start) }),
                  axisLabel: day(w.start),
                  value: w.posts + w.comments,
                }))}
                label={t('activity')}
                period={period}
                averageLabel={t('weeklyAverage')}
                valueLabel={t('thisWeek')}
                categoryLabel={t('week')}
                height={160}
              />
            </section>
            <section className={styles.chartBox}>
              <DonutChart
                label={t('reach')}
                unit={t('people')}
                totalLabel={ts('members')}
                size={168}
                thickness={20}
                data={[
                  { key: 'wrote', label: t('wrote'), value: wrote },
                  { key: 'read', label: t('onlyRead'), value: rows.length - wrote - never },
                  { key: 'never', label: ts('neverVisited'), value: never },
                ]}
              />
            </section>
          </div>
          <SortableDataTable
            rows={rows.map((r) => ({
              id: String(r.personId),
              name: r.name,
              posts: r.posts,
              comments: r.comments,
              reactions: r.reactions,
              lastVisit: r.lastVisit
                ? format.relativeTime(new Date(r.lastVisit), new Date(now))
                : t('never'),
            }))}
            rowKey="id"
            caption={t('tableCaption')}
            columns={[
              { key: 'name', label: t('member'), sortable: true },
              { key: 'posts', label: t('posts'), sortable: true, numeric: true },
              { key: 'comments', label: t('comments'), sortable: true, numeric: true },
              { key: 'reactions', label: t('reactions'), sortable: true, numeric: true },
              { key: 'lastVisit', label: t('lastVisit') },
            ]}
            defaultSort={{ key: 'posts', direction: 'desc' }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
