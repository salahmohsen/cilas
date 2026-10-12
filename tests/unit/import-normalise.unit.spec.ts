import { describe, expect, it } from 'vitest'

import {
  canonicalName,
  courseLegacyUrl,
  cycleFromFile,
  isMostlyArabic,
  splitLocales,
  scheduleOf,
  spaceOf,
} from '../../migration/lib/normalise-courses'
import type { ExtractedCourse } from '../../migration/lib/extraction-schema'

const course = (over: Partial<ExtractedCourse> = {}): ExtractedCourse => ({
  title: 'Story as participative enquiry',
  title_ar: null,
  subtitle: null,
  course_type: 'SHORT',
  fellows: [],
  schedule_text: 'Sundays, 5:30-8 pm',
  weekdays: ['sun'],
  start_time: '17:30',
  end_time: '20:00',
  weeks: 8,
  start_date: '2024-09-21',
  location: ['HYBRID'],
  description: '',
  flow_links: [],
  register_url: null,
  own_page: null,
  ...over,
})

describe('cycleFromFile', () => {
  it.each([
    ['fall-cycle-2024.html', { season: 'fall', start_year: 2024 }],
    ['spring-2021.html', { season: 'spring', start_year: 2021 }],
    ['spring-cycle-20221.html', { season: 'spring', start_year: 2022 }],
    ['2014-2015-second-trimester.html', { season: 'winter', start_year: 2015 }],
    ['2015-2016-third-trimester.html', { season: 'spring', start_year: 2016 }],
    ['winter-cycle-2024-2025.html', { season: 'winter', start_year: 2025 }],
    ['spring-cycle-2024-2025.html', { season: 'spring', start_year: 2025 }],
    ['fall-labs-2022.html', { season: 'fall', start_year: 2022 }],
  ])('%s', (file, expected) => {
    expect(cycleFromFile(file)).toEqual(expected)
  })

  it('is null when the name says nothing usable', () => {
    expect(cycleFromFile('cilas-in-alex-2018-2019.html')).toBeNull()
  })
})

describe('spaceOf', () => {
  it('trusts the page, then Alexandria in the name, then defaults with a flag', () => {
    expect(spaceOf('al-ghuria', 'x.html', '')).toEqual({ space: 'al-Ghuria', guessed: false })
    expect(spaceOf(null, 'cilas-in-alex-2019-2020.html', '')).toEqual({ space: 'al-Manshiya', guessed: false })
    expect(spaceOf(null, 'spring-2021.html', '')).toEqual({ space: 'Darb el-Labbana', guessed: true })
    expect(spaceOf('online', 'summer-2021.html', '')).toEqual({ space: 'Darb el-Labbana', guessed: true })
  })

  it('places undated-venue Cairo cycles by academic year: al-Ghuria to 2016–17, then Darb el-Labbana', () => {
    expect(spaceOf(null, '2015-2016-third-trimester.html', '', 'spring', 2016)).toEqual({ space: 'al-Ghuria', guessed: true })
    expect(spaceOf(null, '2016-2017-third-trimester.html', '', 'spring', 2017)).toEqual({ space: 'al-Ghuria', guessed: true })
    expect(spaceOf(null, 'x.html', '', 'fall', 2017)).toEqual({ space: 'Darb el-Labbana', guessed: true })
    expect(spaceOf(null, '2017-2018-second-trimester.html', '', 'winter', 2018)).toEqual({ space: 'Darb el-Labbana', guessed: true })
  })
})

describe('courseLegacyUrl', () => {
  it("uses the course's own page when it has one, else a fragment of the cycle page", () => {
    expect(courseLegacyUrl('/2014-2015-second-trimester.html', course({ own_page: 'art-and-the-city.html' }))).toBe(
      '/art-and-the-city.html',
    )
    expect(courseLegacyUrl('/fall-cycle-2024.html', course())).toBe(
      '/fall-cycle-2024.html#story-as-participative-enquiry',
    )
  })

  it('ignores own_page links that are not pages on the site', () => {
    expect(courseLegacyUrl('/fall-cycle-2024.html', course({ own_page: 'https://forms.gle/x' }))).toBe(
      '/fall-cycle-2024.html#story-as-participative-enquiry',
    )
  })
})

describe('scheduleOf', () => {
  it('builds the schedule pattern from the extraction', () => {
    expect(scheduleOf(course())).toEqual({
      start_date: '2024-09-21',
      start_precision: 'day',
      weeks: 8,
      slots: [{ weekday: 'sun', start_time: '17:30', end_time: '20:00' }],
      note: 'Sundays, 5:30-8 pm',
    })
  })

  it('keeps only the note when times are unknown', () => {
    expect(scheduleOf(course({ weekdays: [], start_time: null, end_time: null, weeks: null, start_date: null }))).toEqual({
      start_precision: 'day',
      slots: [],
      note: 'Sundays, 5:30-8 pm',
    })
  })
})

describe('names and script', () => {
  it('matches names regardless of accents, case and aliases', () => {
    const aliases = { 'Karim-Yassin Goessinger': ['Karim-Yassin', 'Karim Yassin Goessinger'] }
    expect(canonicalName('karim yassin goessinger', aliases)).toBe('Karim-Yassin Goessinger')
    expect(canonicalName('Hussein  El-Hajj', {})).toBe('Hussein El-Hajj')
  })

  it('detects mostly-Arabic text', () => {
    expect(isMostlyArabic('تفكك أوديب: تجوالات الأسطورة')).toBe(true)
    expect(isMostlyArabic('Unravelling Oedipus')).toBe(false)
  })
})

describe('splitLocales', () => {
  it('puts English and Arabic paragraphs in their own locales, in order', () => {
    expect(splitLocales('Intro.\n\nمقدمة.\n\nMore.\n\nالمزيد.')).toEqual({
      en: 'Intro.\n\nMore.',
      ar: 'مقدمة.\n\nالمزيد.',
    })
  })

  it('leaves a locale empty when the text has none of it', () => {
    expect(splitLocales('مقدمة فقط.')).toEqual({ en: '', ar: 'مقدمة فقط.' })
  })

  it('drops a placeholder for a translation to come', () => {
    expect(splitLocales('Intro.\n\nالترجمة في الطريق')).toEqual({ en: 'Intro.', ar: '' })
  })
})
