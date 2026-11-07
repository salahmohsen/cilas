// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'

import { dashboardWidgets, defaultLayout } from '@/components/admin/dashboard/native-widgets'

const WIDTHS = ['x-small', 'small', 'medium', 'large', 'x-large', 'full'] as const

describe('dashboard widgets (Payload native dashboard)', () => {
  it('gives every widget its own slug', () => {
    const slugs = dashboardWidgets.map((w) => w.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('lays out only widgets that exist, once each', () => {
    const slugs = new Set(dashboardWidgets.map((w) => w.slug))
    const placed = defaultLayout.map((item) => item.widgetSlug as string)
    expect(placed.every((slug) => slugs.has(slug))).toBe(true)
    expect(new Set(placed).size).toBe(placed.length)
  })

  it('starts with quick actions, then the key numbers', () => {
    expect(defaultLayout[0]?.widgetSlug).toBe('quick-actions')
    expect(defaultLayout[1]?.widgetSlug).toBe('open-applications')
  })

  it('keeps each default width between the widget minimum and maximum', () => {
    for (const item of defaultLayout) {
      const widget = dashboardWidgets.find((w) => w.slug === item.widgetSlug)!
      const at = WIDTHS.indexOf(item.width as (typeof WIDTHS)[number])
      expect(at).toBeGreaterThanOrEqual(WIDTHS.indexOf(widget.minWidth ?? 'x-small'))
      expect(at).toBeLessThanOrEqual(WIDTHS.indexOf(widget.maxWidth ?? 'full'))
    }
  })
})

describe('analytics widgets in the dashboard', () => {
  const analytics = [
    'visitors',
    'page-views',
    'site-errors',
    'traffic',
    'top-pages',
    'application-funnel',
    'daily-activity',
  ]

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  const layoutWith = async (keys: Record<string, string>) => {
    vi.resetModules()
    for (const name of ['POSTHOG_API_HOST', 'POSTHOG_PROJECT_ID', 'POSTHOG_PERSONAL_API_KEY']) {
      vi.stubEnv(name, keys[name] ?? '')
    }
    return import('@/components/admin/dashboard/native-widgets')
  }

  it('registers them whatever the settings, so a saved layout keeps them', async () => {
    const { dashboardWidgets } = await layoutWith({})
    const slugs = dashboardWidgets.map((w) => w.slug as string)
    for (const slug of analytics) expect(slugs).toContain(slug)
  })

  it('leaves them out of the default layout without the PostHog settings', async () => {
    const { defaultLayout } = await layoutWith({ POSTHOG_PROJECT_ID: '1' })
    const placed = defaultLayout.map((item) => item.widgetSlug as string)
    for (const slug of analytics) expect(placed).not.toContain(slug)
    expect(placed).toContain('open-applications')
  })

  it('puts them in the default layout with all three settings', async () => {
    const { defaultLayout } = await layoutWith({
      POSTHOG_API_HOST: 'https://eu.posthog.com',
      POSTHOG_PROJECT_ID: '1',
      POSTHOG_PERSONAL_API_KEY: 'phx_test',
    })
    const placed = defaultLayout.map((item) => item.widgetSlug as string)
    for (const slug of analytics) expect(placed).toContain(slug)
  })
})
