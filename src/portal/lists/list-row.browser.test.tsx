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
      it(`a 120-character Arabic title with no space stays on one line at ${width} (${locale})`, async () => {
        await page.viewport(width, 800)
        const row = renderRow(locale)
        const title = row.querySelector('a')!
        expect(row.scrollWidth).toBeLessThanOrEqual(row.clientWidth)
        expect(title.scrollWidth).toBeGreaterThan(title.clientWidth)
        expect(getComputedStyle(title).textOverflow).toBe('ellipsis')
        expect(getComputedStyle(title).whiteSpace).toBe('nowrap')
        const line = parseFloat(getComputedStyle(title).lineHeight)
        expect(title.getBoundingClientRect().height).toBeLessThan(line * 1.5)
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
