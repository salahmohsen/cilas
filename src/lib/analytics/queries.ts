import { CAIRO } from '@/lib/cairo-day'

import { WEB_VITALS } from './stats'

/** For each web vital: page loads that reported it, loads within its "good" limit, and its 75th percentile. */
const vitalColumns = WEB_VITALS.map(({ key, good }) => {
  const value = `toFloat(properties.$web_vitals_${key}_value)`
  return `countIf(isNotNull(${value})) AS ${key.toLowerCase()}_loads,
           countIf(${value} <= ${good}) AS ${key.toLowerCase()}_good,
           quantileIf(0.75)(${value}, isNotNull(${value})) AS ${key.toLowerCase()}_p75`
}).join(',\n           ')

/**
 * The dashboard's HogQL (PostHog's SQL). Every query reads `events` over a
 * fixed window and returns a handful of rows, so the free plan's query
 * allowance is not a concern. Days are Cairo days, as elsewhere on the dashboard.
 */
export const QUERIES = {
  /** `[day, page views, visitors]` for a year: sparklines, the line chart and the heatmap. */
  daily: `
    SELECT toString(toDate(toTimeZone(timestamp, '${CAIRO}'))) AS day,
           count() AS views,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 365 DAY
    GROUP BY day
    ORDER BY day`,

  /** `[path, views last 30 days, views the 30 days before]`. Pages, movement, languages, courses and events read this. */
  pages: `
    SELECT properties.$pathname AS path,
           countIf(timestamp >= now() - INTERVAL 30 DAY) AS views_now,
           countIf(timestamp < now() - INTERVAL 30 DAY) AS views_before
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 60 DAY
    GROUP BY path
    ORDER BY views_now DESC
    LIMIT 500`,

  /** `[source, visitors]`, 30 days: a campaign's utm_source, else the referring domain. */
  referrers: `
    SELECT coalesce(nullIf(toString(properties.utm_source), ''), toString(properties.$referring_domain)) AS source,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY source
    ORDER BY visitors DESC
    LIMIT 50`,

  /** `[device type, visitors]`, 30 days. */
  devices: `
    SELECT toString(properties.$device_type) AS device,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY device
    ORDER BY visitors DESC`,

  /** `[country, visitors]`, 30 days. */
  countries: `
    SELECT toString(properties.$geoip_country_name) AS country,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE event = '$pageview' AND timestamp >= now() - INTERVAL 30 DAY
    GROUP BY country
    ORDER BY visitors DESC
    LIMIT 20`,

  /** `[step, visitors]`, 30 days: the apply pages, then the two apply events. */
  funnel: `
    SELECT if(event = '$pageview', 'viewed', event) AS step,
           count(DISTINCT distinct_id) AS visitors
    FROM events
    WHERE timestamp >= now() - INTERVAL 30 DAY
      AND ((event = '$pageview' AND properties.$pathname LIKE '%/study/%/apply')
           OR event IN ('apply_started', 'apply_submitted'))
    GROUP BY step`,

  /** `[event, count last 30 days, count the 30 days before]` for the site's own events. */
  goals: `
    SELECT event,
           countIf(timestamp >= now() - INTERVAL 30 DAY) AS count_now,
           countIf(timestamp < now() - INTERVAL 30 DAY) AS count_before
    FROM events
    WHERE timestamp >= now() - INTERVAL 60 DAY
      AND event IN ('register_clicked', 'calendar_added', 'newsletter_subscribed',
                    'contact_submitted', 'push_enabled', 'login')
    GROUP BY event`,

  /** One row: `[errors in the last 7 days, errors in the 7 days before]`. */
  errors: `
    SELECT countIf(timestamp >= now() - INTERVAL 7 DAY) AS errors_last7,
           countIf(timestamp < now() - INTERVAL 7 DAY) AS errors_before7
    FROM events
    WHERE event = '$exception' AND timestamp >= now() - INTERVAL 14 DAY`,

  /** One row: `[loads, good, p75]` for each metric in `WEB_VITALS` order, 30 days. */
  webVitals: `
    SELECT ${vitalColumns}
    FROM events
    WHERE event = '$web_vitals' AND timestamp >= now() - INTERVAL 30 DAY`,

  /**
   * One row: `[events, errors]` since the start of this month (the free plan
   * counts a month). PostHog bills errors apart from other events, so the
   * events count leaves them out.
   */
  usage: `
    SELECT countIf(event != '$exception') AS event_count, countIf(event = '$exception') AS error_count
    FROM events
    WHERE timestamp >= toStartOfMonth(now())`,

  /** One row: `[recordings]` since the start of this month. */
  recordings: `
    SELECT count() AS recordings
    FROM session_replay_events
    WHERE min_first_timestamp >= toStartOfMonth(now())`,
} as const

export type QueryName = keyof typeof QUERIES
