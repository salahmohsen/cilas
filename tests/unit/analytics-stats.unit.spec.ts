import { describe, expect, it, vi } from 'vitest'

import { queryConfig, runQuery, QUERY_TIMEOUT_MS } from '@/lib/analytics/posthog-query'
import { QUERIES } from '@/lib/analytics/queries'
import {
  FREE_LIMITS,
  activityFrom,
  deviceSplit,
  errorsFrom,
  funnelFrom,
  goalsFrom,
  languageSplit,
  pageMovement,
  parseRows,
  slugLabel,
  topCountries,
  topCourses,
  topEvents,
  topPages,
  topReferrers,
  trafficFrom,
  usageFrom,
} from '@/lib/analytics/stats'

// Noon in Cairo on 2026-07-31: the last day on the charts.
const NOW = new Date('2026-07-31T09:00:00Z')
const day = (offset: number) => {
  const d = new Date(Date.UTC(2026, 6, 31 + offset))
  return d.toISOString().slice(0, 10)
}

describe('reading a Query API answer', () => {
  it('returns the rows', () => {
    expect(parseRows({ results: [['a', 1]], columns: ['x'] })).toEqual([['a', 1]])
  })
  it.each([null, {}, { results: 'no' }, { results: [1, 2] }])('refuses %j', (body) => {
    expect(() => parseRows(body)).toThrow('unexpected answer')
  })
})

describe('traffic', () => {
  it('totals the last 30 days, compares with the 30 before, and fills quiet days with zeros', () => {
    const rows = [
      // 30 days before: 10 views a day on 2 days = 20; this period: 15 + 25 = 40
      [day(-50), 10, 4],
      [day(-40), 10, 6],
      [day(-10), 15, 5],
      [day(0), 25, 9],
      [day(-200), 999, 999], // a year-old day is outside both periods
    ]
    const t = trafficFrom(rows, NOW)
    expect(t.views).toHaveLength(30)
    expect(t.views.at(-1)).toMatchObject({ key: day(0), value: 25 })
    expect(t.views.find((p) => p.key === day(-5))?.value).toBe(0)
    expect(t.viewsTotal).toBe(40)
    expect(t.viewsChange).toBe('+100%')
    expect(t.visitorsTotal).toBe(14)
    expect(t.visitorsChange).toBe('+40%')
  })

  it('has no change figure when the earlier period was empty', () => {
    const t = trafficFrom([[day(0), 5, 2]], NOW)
    expect(t.viewsChange).toBeNull()
  })

  it('lays out a year for the heatmap', () => {
    const days = activityFrom(
      [
        [day(-364), 3, 1],
        [day(0), 7, 2],
      ],
      NOW,
    )
    expect(days).toHaveLength(365)
    expect(days[0]).toEqual({ date: day(-364), count: 3 })
    expect(days.at(-1)).toEqual({ date: day(0), count: 7 })
  })
})

describe('pages', () => {
  // [path, views now, views before]
  const rows = [
    ['/en/about', 30, 10],
    ['/ar/about', 20, 5],
    ['/en', 100, 80],
    ['/en/study/data-science', 40, 0],
    ['/ar/study/data-science', 10, 0],
    ['/en/study/data-science/apply', 15, 0],
    ['/en/events/open-day', 12, 30],
    ['/en/people/[person]', 3, 3],
  ]

  it('merges the two languages and ranks by views now, ties alphabetically', () => {
    const pages = topPages(rows, 3)
    expect(pages.map((p) => [p.label, p.value])).toEqual([
      ['Home', 100],
      ['/about', 50],
      ['/study/data-science', 50],
    ])
  })

  it('compares the same pages across the two periods', () => {
    const move = pageMovement(rows, 3)
    expect(move.map((m) => m.key)).toEqual(['/', '/about', '/study/data-science'])
    expect(move.find((m) => m.key === '/about')).toMatchObject({ start: 15, end: 50 })
  })

  it('ranks courses and events by their own page, not their apply page', () => {
    expect(topCourses(rows)).toEqual([{ key: 'data-science', label: 'Data science', value: 50 }])
    expect(topEvents(rows)).toEqual([{ key: 'open-day', label: 'Open day', value: 12 }])
  })

  it('splits page views by site language', () => {
    expect(languageSplit(rows)).toEqual([
      { key: 'en', label: 'English', value: 100 + 30 + 40 + 15 + 12 + 3 },
      { key: 'ar', label: 'Arabic', value: 30 },
    ])
  })

  it('makes a readable label from a slug', () => {
    expect(slugLabel('bridge-programme')).toBe('Bridge programme')
  })
})

describe('audience', () => {
  it('names a blank device unknown and joins repeats', () => {
    expect(
      deviceSplit([
        ['Mobile', 6],
        ['Desktop', 3],
        ['', 1],
        ['mobile', 2],
      ]),
    ).toEqual([
      { key: 'mobile', label: 'Mobile', value: 8 },
      { key: 'desktop', label: 'Desktop', value: 3 },
      { key: 'unknown', label: 'Unknown', value: 1 },
    ])
  })

  it('skips visitors with no country', () => {
    expect(
      topCountries([
        ['Egypt', 5],
        [null, 9],
        ['Germany', 2],
      ]),
    ).toEqual([
      { key: 'Egypt', label: 'Egypt', value: 5 },
      { key: 'Germany', label: 'Germany', value: 2 },
    ])
  })
})

describe('referrers', () => {
  it('names no referrer Direct, drops the site itself, and joins www', () => {
    const list = topReferrers(
      [
        ['$direct', 10],
        [null, 5],
        ['www.google.com', 7],
        ['google.com', 3],
        ['ci-las.org', 40],
        ['www.ci-las.org', 2],
        ['newsletter', 4],
      ],
      ['ci-las.org'],
    )
    expect(list.map((r) => [r.label, r.value])).toEqual([
      ['Direct', 15],
      ['google.com', 10],
      ['newsletter', 4],
    ])
  })
})

describe('apply funnel', () => {
  it('counts three steps with the share of the first and of the step before', () => {
    const steps = funnelFrom([
      ['viewed', 200],
      ['apply_started', 80],
      ['apply_submitted', 20],
    ])
    expect(steps.map((s) => [s.key, s.visitors, s.ofFirst, s.ofPrevious])).toEqual([
      ['viewed', 200, null, null],
      ['started', 80, 40, 40],
      ['submitted', 20, 10, 25],
    ])
  })

  it('never lets a step exceed the one before', () => {
    const steps = funnelFrom([
      ['viewed', 10],
      ['apply_started', 12],
      ['apply_submitted', 11],
    ])
    expect(steps.map((s) => s.visitors)).toEqual([10, 10, 10])
  })

  it('has no shares when nobody viewed a form, and survives missing rows', () => {
    const steps = funnelFrom([])
    expect(steps.map((s) => s.visitors)).toEqual([0, 0, 0])
    expect(steps[1]?.ofFirst).toBeNull()
  })
})

describe('goals and errors', () => {
  it('lists every goal, zero when unseen, with the change on the period before', () => {
    const goals = goalsFrom([
      ['newsletter_subscribed', 12, 10],
      ['login', 3, 0],
    ])
    expect(goals).toHaveLength(6)
    expect(goals.find((g) => g.key === 'newsletter_subscribed')).toMatchObject({
      current: 12,
      change: '+20%',
    })
    expect(goals.find((g) => g.key === 'login')?.change).toBeNull()
    expect(goals.find((g) => g.key === 'calendar_added')).toMatchObject({ current: 0 })
  })

  it('counts errors against the week before', () => {
    expect(errorsFrom([[9, 12]])).toEqual({ last7: 9, change: '-25%' })
    expect(errorsFrom([])).toEqual({ last7: 0, change: null })
  })
})

describe('the free plan allowance', () => {
  it('measures events and errors, and recordings when they could be read', () => {
    const meters = usageFrom([[250_000, 40]], [[300]])
    expect(meters.map((m) => [m.key, m.used, m.limit])).toEqual([
      ['events', 250_000, FREE_LIMITS.events],
      ['errors', 40, FREE_LIMITS.errors],
      ['recordings', 300, FREE_LIMITS.recordings],
    ])
  })

  it('leaves recordings out when that query failed', () => {
    expect(usageFrom([[1, 0]], null).map((m) => m.key)).toEqual(['events', 'errors'])
  })
})

describe('the HogQL', () => {
  it('uses the free plan only through named, bounded windows', () => {
    for (const query of Object.values(QUERIES)) {
      expect(query).toMatch(/INTERVAL \d+ DAY|toStartOfMonth/)
    }
  })
})

describe('asking PostHog', () => {
  const config = { apiHost: 'https://eu.posthog.com', projectId: '329899', apiKey: 'phx_secret' }

  it('needs all three settings', () => {
    expect(queryConfig({})).toBeNull()
    expect(
      queryConfig({ POSTHOG_API_HOST: 'https://eu.posthog.com/', POSTHOG_PROJECT_ID: '1' }),
    ).toBeNull()
    expect(
      queryConfig({
        POSTHOG_API_HOST: 'https://eu.posthog.com/',
        POSTHOG_PROJECT_ID: '1',
        POSTHOG_PERSONAL_API_KEY: 'k',
      }),
    ).toEqual({ apiHost: 'https://eu.posthog.com', projectId: '1', apiKey: 'k' })
  })

  it('posts a HogQL query with the key as a bearer token and a time limit', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({ results: [[1]] }) })
    const rows = await runQuery(config, 'SELECT   1\n FROM events', fetchMock as typeof fetch)
    expect(rows).toEqual([[1]])
    const [url, init] = fetchMock.mock.calls[0]!
    expect(url).toBe('https://eu.posthog.com/api/projects/329899/query/')
    expect(init.method).toBe('POST')
    expect(init.headers.Authorization).toBe('Bearer phx_secret')
    expect(JSON.parse(init.body)).toEqual({
      name: 'cilas-dashboard',
      query: { kind: 'HogQLQuery', query: 'SELECT 1 FROM events' },
    })
    expect(init.signal).toBeInstanceOf(AbortSignal)
    expect(QUERY_TIMEOUT_MS).toBeLessThanOrEqual(5000)
  })

  it('fails without leaking the key or the body', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: 'bad key phx_secret' }),
    })
    const error = await runQuery(config, 'q', fetchMock as typeof fetch).catch((e: Error) => e)
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe('PostHog query failed with status 401')
    expect((error as Error).message).not.toContain('phx_secret')
  })

  it('fails on a wrongly shaped answer', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ nope: 1 }) })
    await expect(runQuery(config, 'q', fetchMock as typeof fetch)).rejects.toThrow('unexpected')
  })
})
