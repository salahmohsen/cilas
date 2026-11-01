import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { dashboardWidgets, defaultLayout } from '@/components/admin/dashboard/native-widgets'

const WIDTHS = ['x-small', 'small', 'medium', 'large', 'x-large', 'full'] as const
const nativeSource = readFileSync('src/components/admin/dashboard/native.tsx', 'utf8')

describe('dashboard widgets (Payload native dashboard)', () => {
  it('gives every widget its own slug', () => {
    const slugs = dashboardWidgets.map((w) => w.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('points each widget at a component native.tsx exports', () => {
    for (const widget of dashboardWidgets) {
      const [path, name] = String(widget.Component).split('#')
      expect(path).toBe('/components/admin/dashboard/native')
      expect(nativeSource).toMatch(new RegExp(`export (const|function) ${name}\\b`))
    }
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
