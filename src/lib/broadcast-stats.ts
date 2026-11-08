import { resend } from '@/lib/resend'

export type BroadcastStats = {
  fetchedAt: string
  sent: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
  openRate: number
  clickRate: number
  timeline: { day: string; opened: number; clicked: number }[]
  links: { url: string; clicks: number; uniqueClicks: number }[]
}

const METRICS = [
  'sent',
  'delivered',
  'unique_opened',
  'unique_clicked',
  'bounced',
  'complained',
  'unsubscribed',
  'open_rate',
  'click_rate',
]

type Row = Record<string, unknown>

const count = (row: Row | undefined, key: string) => Number(row?.[key] ?? 0) || 0

export const statsFrom = (metrics: Row, links: Row, fetchedAt: string): BroadcastStats => {
  const totals = metrics.totals as Row | undefined
  const days = (metrics.data ?? []) as Row[]
  return {
    fetchedAt,
    sent: count(totals, 'sent'),
    delivered: count(totals, 'delivered'),
    opened: count(totals, 'unique_opened'),
    clicked: count(totals, 'unique_clicked'),
    bounced: count(totals, 'bounced'),
    complained: count(totals, 'complained'),
    unsubscribed: count(totals, 'unsubscribed'),
    openRate: count(totals, 'open_rate'),
    clickRate: count(totals, 'click_rate'),
    timeline: days.map((row) => ({
      day: String(row.period),
      opened: count(row, 'unique_opened'),
      clicked: count(row, 'unique_clicked'),
    })),
    links: ((links.data ?? []) as Row[]).map((row) => ({
      url: String(row.url),
      clicks: count(row, 'clicks'),
      uniqueClicks: count(row, 'unique_clicks'),
    })),
  }
}

const read = async (path: string) => {
  const { ok, status, body } = await resend(path)
  if (!ok) throw new Error((body.message as string) ?? `Resend answered ${status}`)
  return body
}

export const fetchBroadcastStats = async (broadcastId: string, sentAt: string) => {
  const now = new Date().toISOString()
  const query = new URLSearchParams({
    start_date: sentAt.slice(0, 10),
    end_date: now.slice(0, 10),
    granularity: 'daily',
    dimensions: 'period,broadcast',
    metrics: METRICS.join(','),
    broadcast_id: broadcastId,
  })
  const [metrics, links] = await Promise.all([
    read(`/emails/metrics?${query}`),
    read(`/broadcasts/${broadcastId}/clicked-links?limit=20`),
  ])
  return statsFrom(metrics, links, now)
}
