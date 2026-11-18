import { readFileSync } from 'node:fs'
import { createFormatter, createTranslator } from 'next-intl'
import { describe, expect, it } from 'vitest'

import { monthList, type MonthWords } from './course-reader-snapshot'
import { formatsOf } from '@/i18n/formats'
import { CAIRO } from '@/lib/cairo-day'

const sample = (locale: 'en' | 'ar') =>
  new DOMParser().parseFromString(
    readFileSync(`testing/files/calendar-month/${locale}-2026-11.html`, 'utf8'),
    'text/html',
  )
const expected = JSON.parse(
  readFileSync('testing/files/calendar-month/expected.json', 'utf8'),
) as Record<'en' | 'ar', Array<[string, string]>>

const wordsOf = (locale: 'en' | 'ar') => {
  const intl = {
    locale,
    timeZone: CAIRO,
    formats: formatsOf(locale),
    messages: JSON.parse(readFileSync(`messages/${locale}.json`, 'utf8')),
  }
  const format = createFormatter(intl)
  return {
    locale,
    number: (value, options) => format.number(value, options),
    dateTime: (value, options) => format.dateTime(value, options),
    cancelled: createTranslator({ ...intl, namespace: 'Calendar' })('cancelled'),
  } satisfies MonthWords
}

describe('monthList', () => {
  it.each(['en', 'ar'] as const)(
    'reads the same lines from the new %s month page as from the old one',
    (locale) => {
      const lines = monthList(sample(locale), wordsOf(locale))
      expect(lines.toSorted()).toEqual(expected[locale].toSorted())
    },
  )

  it('keeps the timed, all-day and cancelled meetings apart', () => {
    const lines = monthList(sample('en'), wordsOf('en')).map(([, line]) => line)
    expect(lines).toContain(
      '18WednesdayNovember 2026 | 13:00–15:00 | Session 9 · Cancelled | cancelled',
    )
    expect(lines).toContain('16MondayNovember 2026 |  | Session 5 | ')
    expect(lines).toContain('7SaturdayNovember 2026 | 10:30–12:00 | Session 1 | ')
  })

  it('reads only the phone list: the month grid repeats its days', () => {
    const page = sample('en')
    page.querySelector('[data-width="narrow"] li[data-day]')?.remove()
    expect(monthList(page, wordsOf('en'))).toHaveLength(expected.en.length - 1)
  })
})
