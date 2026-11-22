import { cleanup, render } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { createFormatter, createTranslator } from 'next-intl'
import { afterEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import '../../components/arc/foundation.css'
import '../theme/tokens.css'
import { formatsOf } from '@/i18n/formats'
import { CAIRO } from '@/lib/cairo-day'
import { messagesOf } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-browser.test-utils'
import { ListRowBody, type RowIntl } from './list-row'
import type { ListRow } from './rows'

mockNetwork(http.get('/_next/image', () => new HttpResponse(null, { status: 404 })))

const LONG_ARABIC = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي'.repeat(5).slice(0, 120)

const ROW: ListRow = {
  id: 7,
  collection: 'articles',
  key: 'published_edits_declined',
  group: 'inProgress',
  title: LONG_ARABIC,
  cover: null,
  updatedAt: '2026-11-20T12:00:00Z',
  waitingSince: '2026-11-19T12:00:00Z',
  owners: ['A writer with a long name', 'Another writer'],
  tier: 'community',
  course: null,
}

const intlOf = (locale: 'en' | 'ar') =>
  ({
    t: createTranslator({
      locale,
      messages: messagesOf[locale],
      namespace: 'Portal',
      formats: formatsOf(locale),
      timeZone: CAIRO,
    }),
    tStudy: createTranslator({
      locale,
      messages: messagesOf[locale],
      namespace: 'Study.filters',
      formats: formatsOf(locale),
      timeZone: CAIRO,
    }),
    format: createFormatter({ locale, timeZone: CAIRO }),
    locale,
    now: new Date('2026-11-22T12:00:00Z'),
  }) as unknown as RowIntl

const renderRow = (locale: 'en' | 'ar', row: ListRow = ROW) => {
  document.documentElement.setAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr')
  const view = render(
    <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>
      <ListRowBody row={row} viewer="admin" {...intlOf(locale)} />
    </ol>,
  )
  return view.container.querySelector('li')!
}

afterEach(() => {
  cleanup()
  document.documentElement.removeAttribute('dir')
})

describe('ListRowBody layout', () => {
  for (const width of [390, 1440])
    for (const locale of ['ar', 'en'] as const)
      it(`a 120-character Arabic title with no space takes at most two lines at ${width} (${locale})`, async () => {
        await page.viewport(width, 800)
        const row = renderRow(locale)
        const title = row.querySelector<HTMLElement>('a > span')!
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
        const style = getComputedStyle(title)
        expect(style.webkitLineClamp).toBe('2')
        const line = parseFloat(style.lineHeight)
        expect(title.getBoundingClientRect().height).toBeLessThanOrEqual(line * 2 + 0.5)
        if (width === 390) {
          expect(title.scrollHeight).toBeGreaterThan(title.clientHeight)
          expect(title.getBoundingClientRect().height).toBeGreaterThan(line * 1.5)
        }
      })

  for (const locale of ['ar', 'en'] as const)
    it(`a long title of many words is cut at two lines, with no title attribute (${locale})`, async () => {
      await page.viewport(390, 800)
      const words = 'عنوان طويل جدا يمتد على عدة أسطر '.repeat(12).trim()
      const row = renderRow(locale, { ...ROW, title: words })
      const link = row.querySelector('a')!
      expect(link.hasAttribute('title')).toBe(false)
      const text = link.querySelector<HTMLElement>('span')!
      const line = parseFloat(getComputedStyle(text).lineHeight)
      expect(text.getBoundingClientRect().height).toBeCloseTo(line * 2, 0)
    })

  it('an Arabic row puts a Latin title at the inline start, on the right', async () => {
    await page.viewport(390, 800)
    const link = renderRow('ar', { ...ROW, title: 'Notes on method' }).querySelector('a')!
    const box = link.querySelector('bdi')!.getBoundingClientRect()
    const edge = link.getBoundingClientRect()
    expect(edge.right - box.right).toBeLessThan(2)
    expect(box.left - edge.left).toBeGreaterThan(edge.width / 2 - box.width)
  })

  it('an English row puts an Arabic title at the inline start, on the left', async () => {
    await page.viewport(390, 800)
    const link = renderRow('en', { ...ROW, title: 'ملاحظات عن المنهج' }).querySelector('a')!
    const box = link.querySelector('bdi')!.getBoundingClientRect()
    expect(box.left - link.getBoundingClientRect().left).toBeLessThan(2)
  })

  for (const locale of ['ar', 'en'] as const)
    it(`two badges and the meta line fit at 320 (${locale})`, async () => {
      await page.viewport(320, 800)
      const row = renderRow(locale)
      expect(row.querySelectorAll('[data-status-badge]')).toHaveLength(2)
      expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(320)
      for (const part of row.querySelectorAll(
        '[data-meta], [data-status-badge], [data-next-action]',
      ))
        expect(part.getBoundingClientRect().right).toBeLessThanOrEqual(320 + 0.5)
    })

  it('the row link is at least 24x24', async () => {
    await page.viewport(1440, 800)
    const box = renderRow('en', { ...ROW, title: 'A' })
      .querySelector('a')!
      .getBoundingClientRect()
    expect(box.width).toBeGreaterThanOrEqual(24)
    expect(box.height).toBeGreaterThanOrEqual(24)
  })

  it('the slot is 40 by 40', async () => {
    await page.viewport(1440, 800)
    const slot = renderRow('en').querySelector('[data-slot]')!.getBoundingClientRect()
    expect([slot.width, slot.height]).toEqual([40, 40])
  })
})
