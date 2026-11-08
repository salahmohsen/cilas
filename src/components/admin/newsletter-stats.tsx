'use client'

import { useDocumentInfo } from '@payloadcms/ui'
import { useEffect, useState } from 'react'

import { DonutChart } from '@/components/arc/donut-chart/donut-chart'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { LineChart } from '@/components/arc/line-chart/line-chart'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { Progress } from '@/components/arc/progress/progress'
import type { BroadcastStats } from '@/lib/broadcast-stats'

import './dashboard/arc-scope.css'
import styles from './newsletter-stats.module.css'

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stats: BroadcastStats | null }

/** The Statistics tab of a newsletter: Resend's numbers for this issue's send. */
export function NewsletterStats() {
  const { id } = useDocumentInfo()
  const [state, setState] = useState<State>({ status: 'loading' })

  useEffect(() => {
    if (!id) return
    let live = true
    fetch(`/api/newsletters/${id}/stats`, { credentials: 'include' })
      .then(async (res) => {
        const body = (await res.json()) as { stats?: BroadcastStats | null; error?: string }
        if (!live) return
        setState(
          res.ok
            ? { status: 'ready', stats: body.stats ?? null }
            : { status: 'error', message: body.error ?? 'Could not load the statistics.' },
        )
      })
      .catch(() => live && setState({ status: 'error', message: 'Could not load the statistics.' }))
    return () => {
      live = false
    }
  }, [id])

  return <div className="arc-scope">{id ? <Body state={state} /> : <None />}</div>
}

const None = () => (
  <EmptyState
    title="No statistics for this issue"
    description="Statistics appear after an issue is sent to a list from this admin. Issues from the old archive have none."
  />
)

function Body({ state }: { state: State }) {
  if (state.status === 'loading') return <p className={styles.note}>Loading statistics.</p>
  if (state.status === 'error') return <p className={styles.note}>{state.message}</p>
  const { stats } = state
  if (!stats) return <None />
  const share = (part: number) => (stats.sent ? Math.round((part / stats.sent) * 100) : 0)
  return (
    <div className={styles.stats}>
      <div className={styles.metrics}>
        <MetricCard label="Sent" value={stats.sent} context="People on the list" />
        <MetricCard
          label="Delivered"
          value={stats.delivered}
          context={`${share(stats.delivered)}% of sent`}
        />
        <MetricCard
          label="Open rate"
          value={stats.openRate}
          suffix="%"
          context={`${stats.opened} people. Some mail apps open images by themselves.`}
        />
        <MetricCard
          label="Click rate"
          value={stats.clickRate}
          suffix="%"
          context={`${stats.clicked} people`}
        />
      </div>
      <div className={styles.split}>
        <div className={styles.rates}>
          <Progress label="Delivered" value={share(stats.delivered)} showValue />
          <Progress label="Opened" value={share(stats.opened)} showValue />
          <Progress label="Clicked" value={share(stats.clicked)} showValue />
          <p className={styles.note}>
            Share of the {stats.sent} people it was sent to. {stats.unsubscribed} unsubscribed.
          </p>
        </div>
        <DonutChart
          label="Delivery outcome"
          unit="emails"
          totalLabel="Sent"
          data={[
            { key: 'delivered', label: 'Delivered', value: stats.delivered },
            { key: 'bounced', label: 'Bounced', value: stats.bounced },
            { key: 'complained', label: 'Marked as spam', value: stats.complained },
          ]}
        />
      </div>
      {stats.timeline.length > 1 ? (
        <LineChart
          label="Opens and clicks by day"
          series={[
            { key: 'opened', label: 'Opened' },
            { key: 'clicked', label: 'Clicked' },
          ]}
          data={stats.timeline.map((point) => ({
            key: point.day,
            label: point.day,
            axisLabel: point.day.slice(5),
            values: { opened: point.opened, clicked: point.clicked },
          }))}
        />
      ) : null}
      {stats.links.length ? (
        <div>
          <h3 className={styles.heading}>Most clicked links</h3>
          <ol className={styles.links}>
            {stats.links.map((link) => (
              <li key={link.url} className={styles.link}>
                <a className={styles.url} href={link.url} rel="noopener noreferrer" target="_blank">
                  {link.url}
                </a>
                <span>{link.uniqueClicks} people</span>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      <p className={styles.note}>Updated {new Date(stats.fetchedAt).toLocaleString()}.</p>
    </div>
  )
}
