import { pointsFromCounts, percentChange, totalOf, type TimePoint } from '@/lib/admin-stats'

import { stripLocale } from './paths'

/**
 * Turning PostHog's query rows into what the dashboard draws. Rows come from
 * HogQL as arrays of loose values; each reader coerces them once, here.
 */
type Row = readonly unknown[]

const text = (value: unknown): string => (value == null ? '' : String(value))
const count = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** The `results` array of a Query API response, or an error if the answer is not one. */
export const parseRows = (body: unknown): Row[] => {
  const results = (body as { results?: unknown } | null)?.results
  if (!Array.isArray(results) || !results.every(Array.isArray)) {
    throw new Error('PostHog returned an unexpected answer')
  }
  return results as Row[]
}

/* Traffic */

export type Traffic = {
  /** The last 30 days, oldest first. */
  views: TimePoint[]
  visitors: TimePoint[]
  viewsTotal: number
  visitorsTotal: number
  /** "+12%" against the 30 days before, or null when there is nothing to compare. */
  viewsChange: string | null
  visitorsChange: string | null
}

const PERIOD = 30

/** Rows are `[day, views, visitors]` for a year. The last 60 days make this period and the one before. */
export const trafficFrom = (rows: Row[], now = new Date()): Traffic => {
  const views = new Map<string, number>()
  const visitors = new Map<string, number>()
  for (const [day, v, u] of rows) {
    views.set(text(day), count(v))
    visitors.set(text(day), count(u))
  }
  const split = (counts: Map<string, number>) => {
    const points = pointsFromCounts(counts, PERIOD * 2, now)
    return { before: points.slice(0, PERIOD), current: points.slice(PERIOD) }
  }
  const v = split(views)
  const u = split(visitors)
  return {
    views: v.current,
    visitors: u.current,
    viewsTotal: totalOf(v.current),
    visitorsTotal: totalOf(u.current),
    viewsChange: percentChange(totalOf(v.current), totalOf(v.before)),
    visitorsChange: percentChange(totalOf(u.current), totalOf(u.before)),
  }
}

/** One entry per Cairo day for the last year, oldest first, for the activity heatmap. */
export const activityFrom = (rows: Row[], now = new Date()): { date: string; count: number }[] => {
  const views = new Map(rows.map(([day, v]) => [text(day), count(v)]))
  return pointsFromCounts(views, 365, now).map(({ key, value }) => ({ date: key, count: value }))
}

/** The first `keep` entries, with the rest added up as one "Other" (a waffle needs every share in it). */
export const withOther = (list: Ranked[], keep: number, label = 'Other'): Ranked[] => {
  if (list.length <= keep) return list
  const rest = list.slice(keep).reduce((sum, item) => sum + item.value, 0)
  return [...list.slice(0, keep), { key: 'other', label, value: rest }]
}

/* Pages */

export type Ranked = { key: string; label: string; value: number }

/** "data-science" becomes "Data science". */
export const slugLabel = (slug: string): string => {
  const words = decodeURIComponent(slug).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Rows are `[path, views now, views before]`. English and Arabic versions of
 * one page count together.
 */
const viewsByPath = (rows: Row[], column: 1 | 2 = 1): Map<string, number> => {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const key = stripLocale(text(row[0]))
    totals.set(key, (totals.get(key) ?? 0) + count(row[column]))
  }
  return totals
}

const ranked = (
  entries: Iterable<[string, number]>,
  limit: number,
  label: (key: string) => string,
) =>
  [...entries]
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, value]): Ranked => ({ key, label: label(key), value }))

const pageLabel = (path: string) => (path === '/' ? 'Home' : path)

/** All page views in the last 30 days, whatever the page: the whole that the top lists share. */
export const totalViewsOf = (rows: Row[]): number =>
  rows.reduce((sum, row) => sum + count(row[1]), 0)

export const topPages = (rows: Row[], limit = 8): Ranked[] =>
  ranked(viewsByPath(rows), limit, pageLabel)

export type Movement = { key: string; label: string; start: number; end: number }

/** The busiest pages of the two periods together, with their views in each (for the slope chart). */
export const pageMovement = (rows: Row[], limit = 8): Movement[] => {
  const now = viewsByPath(rows, 1)
  const before = viewsByPath(rows, 2)
  return [...new Set([...now.keys(), ...before.keys()])]
    .map((key) => ({
      key,
      label: pageLabel(key),
      start: before.get(key) ?? 0,
      end: now.get(key) ?? 0,
    }))
    .filter((page) => page.start + page.end > 0)
    .sort((a, b) => b.start + b.end - (a.start + a.end) || a.key.localeCompare(b.key))
    .slice(0, limit)
}

const LANGUAGES: Record<string, string> = { en: 'English', ar: 'Arabic' }

/** Page views by site language, read from the address. */
export const languageSplit = (rows: Row[]): Ranked[] => {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const code = /^\/(en|ar)(?:\/|$)/.exec(text(row[0]))?.[1]
    if (code) totals.set(code, (totals.get(code) ?? 0) + count(row[1]))
  }
  return ranked(totals, 5, (code) => LANGUAGES[code] ?? code)
}

/** `/study/<slug>` and `/events/<slug>` only; their sub-pages (apply) do not count as a view of the course. */
const detailPages = (rows: Row[], section: 'study' | 'events') => {
  const found = new Map<string, number>()
  for (const [path, views] of viewsByPath(rows)) {
    const match = new RegExp(`^/${section}/([^/]+)$`).exec(path)
    if (match?.[1]) found.set(match[1], views)
  }
  return found
}

export const topCourses = (rows: Row[], limit = 5): Ranked[] =>
  ranked(detailPages(rows, 'study'), limit, slugLabel)

export const topEvents = (rows: Row[], limit = 5): Ranked[] =>
  ranked(detailPages(rows, 'events'), limit, slugLabel)

/* Audience */

/** Rows are `[device type, visitors]`. A blank type is "Unknown". */
export const deviceSplit = (rows: Row[]): Ranked[] => {
  const totals = new Map<string, number>()
  for (const [device, visitors] of rows) {
    const key = text(device).trim().toLowerCase() || 'unknown'
    totals.set(key, (totals.get(key) ?? 0) + count(visitors))
  }
  return ranked(totals, 6, slugLabel)
}

/** Rows are `[country, visitors]`. */
export const topCountries = (rows: Row[], limit = 6): Ranked[] => {
  const totals = new Map<string, number>()
  for (const [country, visitors] of rows) {
    const name = text(country).trim()
    if (name && name !== 'null') totals.set(name, (totals.get(name) ?? 0) + count(visitors))
  }
  return ranked(totals, limit, (name) => name)
}

/* Referrers */

const DIRECT = 'Direct'

/**
 * Rows are `[source, visitors]`, where source is a campaign's `utm_source` or
 * else the referring domain. Our own domains are visits from inside the site
 * and are dropped; no referrer at all is "Direct".
 */
export const topReferrers = (rows: Row[], ownHosts: string[], limit = 8): Ranked[] => {
  const own = new Set(ownHosts.map((host) => host.replace(/^www\./, '')))
  const totals = new Map<string, number>()
  for (const [source, visitors] of rows) {
    const raw = text(source).trim()
    const name = !raw || raw === '$direct' ? DIRECT : raw.replace(/^www\./, '')
    if (own.has(name)) continue
    totals.set(name, (totals.get(name) ?? 0) + count(visitors))
  }
  return ranked(totals, limit, (name) => name)
}

/* Apply funnel */

export type FunnelStep = {
  key: 'viewed' | 'started' | 'submitted'
  label: string
  visitors: number
  /** Share of the first step, 0 to 100, or null when nobody viewed the form. */
  ofFirst: number | null
  /** Share of the step before it, 0 to 100, or null for the first step. */
  ofPrevious: number | null
}

const STEPS = [
  { key: 'viewed', label: 'Viewed an application' },
  { key: 'started', label: 'Started it' },
  { key: 'submitted', label: 'Sent it' },
] as const

const percent = (part: number, whole: number) =>
  whole > 0 ? Math.round((part / whole) * 100) : null

/**
 * Rows are `[step, visitors]` with step `viewed`, `apply_started` or
 * `apply_submitted`. A later step never counts above the one before it: a
 * visitor who sent the form without a counted start (a page opened before the
 * period began) is still one of those who viewed it.
 */
export const funnelFrom = (rows: Row[]): FunnelStep[] => {
  const by = new Map(rows.map(([step, visitors]) => [text(step), count(visitors)]))
  const raw = [by.get('viewed') ?? 0, by.get('apply_started') ?? 0, by.get('apply_submitted') ?? 0]
  const counts = raw.map((value, i) => Math.min(value, ...raw.slice(0, i)))
  return STEPS.map(({ key, label }, i) => ({
    key,
    label,
    visitors: counts[i]!,
    ofFirst: i === 0 ? null : percent(counts[i]!, counts[0]!),
    ofPrevious: i === 0 ? null : percent(counts[i]!, counts[i - 1]!),
  }))
}

/* Goals: the site's own events */

/** The events the site sends besides page views, in the order the dashboard lists them. */
export const GOALS = [
  { key: 'register_clicked', label: 'Event registrations clicked' },
  { key: 'calendar_added', label: 'Added to a calendar' },
  { key: 'newsletter_subscribed', label: 'Newsletter signups' },
  { key: 'contact_submitted', label: 'Contact messages sent' },
  { key: 'push_enabled', label: 'Phone notifications turned on' },
  { key: 'login', label: 'Sign-ins' },
] as const

export type Goal = { key: string; label: string; current: number; change: string | null }

/** Rows are `[event, count now, count before]`. Events with no row show as zero. */
export const goalsFrom = (rows: Row[]): Goal[] => {
  const by = new Map(rows.map(([event, now, before]) => [text(event), [count(now), count(before)]]))
  return GOALS.map(({ key, label }) => {
    const [current = 0, before = 0] = by.get(key) ?? []
    return { key, label, current, change: percentChange(current, before) }
  })
}

/* Errors */

export type ErrorCount = { last7: number; before7: number | null; change: string | null }

/** One row: `[errors in the last 7 days, errors in the 7 days before]`. */
export const errorsFrom = (rows: Row[]): ErrorCount => {
  const [current, before] = rows[0] ?? []
  return {
    last7: count(current),
    before7: rows[0] ? count(before) : null,
    change: percentChange(count(current), count(before)),
  }
}

/* Web vitals */

/**
 * The four metrics PostHog measures, in the order the dashboard shows them
 * (the three Core Web Vitals first), with Google's "good" limit for each.
 * Milliseconds, except CLS, which has no unit.
 */
export const WEB_VITALS = [
  { key: 'LCP', label: 'Largest paint (LCP)', good: 2500, unit: 'ms' },
  { key: 'INP', label: 'Response to input (INP)', good: 200, unit: 'ms' },
  { key: 'CLS', label: 'Layout shift (CLS)', good: 0.1, unit: 'score' },
  { key: 'FCP', label: 'First paint (FCP)', good: 1800, unit: 'ms' },
] as const

/** Google's pass mark: a metric passes when this share of page loads is good. */
export const WEB_VITALS_PASS = 75

export type WebVital = {
  key: (typeof WEB_VITALS)[number]['key']
  label: string
  /** Page loads that reported this metric. */
  loads: number
  /** Share of those loads within Google's "good" limit, 0 to 100. */
  goodShare: number
  /** The 75th percentile, written for people: "2.1 s", "180 ms", "0.05". */
  p75: string
}

const formatVital = (value: number, unit: 'ms' | 'score'): string => {
  if (unit === 'score') return value.toFixed(2)
  return value < 1000 ? `${Math.round(value)} ms` : `${(value / 1000).toFixed(1)} s`
}

/**
 * One row: for each metric in `WEB_VITALS` order, `[loads, good loads, p75]`.
 * A metric no page load reported is left out.
 */
export const webVitalsFrom = (rows: Row[]): WebVital[] => {
  const row = rows[0] ?? []
  return WEB_VITALS.flatMap(({ key, label, unit }, i) => {
    const loads = count(row[i * 3])
    if (loads === 0) return []
    const good = Math.min(count(row[i * 3 + 1]), loads)
    return [
      {
        key,
        label,
        loads,
        goodShare: Math.round((good / loads) * 100),
        p75: formatVital(count(row[i * 3 + 2]), unit),
      },
    ]
  })
}

/* The free plan's monthly allowance */

/** Free plan limits per month (https://posthog.com/pricing). */
export const FREE_LIMITS = { events: 1_000_000, recordings: 5_000, errors: 100_000 } as const

export type Usage = { key: keyof typeof FREE_LIMITS; label: string; used: number; limit: number }

/**
 * `usage` is `[events, errors]` and `recordings` is `[recordings]`, both since
 * the start of the month. Recordings are optional: if that query fails the
 * meter is left out rather than the whole widget.
 */
export const usageFrom = (usage: Row[], recordings: Row[] | null): Usage[] => {
  const [events, errors] = usage[0] ?? []
  const meters: Usage[] = [
    { key: 'events', label: 'Events', used: count(events), limit: FREE_LIMITS.events },
    { key: 'errors', label: 'Errors', used: count(errors), limit: FREE_LIMITS.errors },
  ]
  if (recordings) {
    meters.push({
      key: 'recordings',
      label: 'Recordings',
      used: count(recordings[0]?.[0]),
      limit: FREE_LIMITS.recordings,
    })
  }
  return meters
}
