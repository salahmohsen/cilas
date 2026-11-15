import { describe, expect, it } from 'vitest'

import {
  classify,
  compareSnapshots,
  courseSlugOf,
  describeChange,
  icsByCourse,
  llmsTimes,
  onlyAdds,
  onlyLabels,
  onlyLengthGone,
  onlyListMarkers,
  onlyRemovals,
  onlyUnits,
  toDays,
  type Accepted,
  type CourseMeta,
  type Snapshot,
} from '../../scripts/course-reader-snapshot'

const plain: CourseMeta = {
  slug: 'plain',
  archiveDated: false,
  undatedWords: false,
  newSessions: 0,
}

const snapshot = (
  readers: Snapshot['readers'],
  courses: Record<string, CourseMeta> = { '1': plain },
): Snapshot => ({ label: 'x', today: '2026-11-13', courses, readers })

describe('classify', () => {
  const was = { en: ['Session 1: A'] }
  const grew = { en: ['Session 1: A', 'Session 2'] }

  it('expects any change in an archive-dated course', () => {
    for (const reader of ['page.facts', 'list.study', 'space.lastMeeting'])
      expect(classify(reader, { ...plain, archiveDated: true }, 'a', 'b').verdict).toBe('EXPECTED')
  })

  it('expects new untitled sessions to add lines where sessions are listed, never in start dates', () => {
    const meta = { ...plain, newSessions: 2 }
    for (const reader of ['page.syllabus', 'calendar.ics', 'llms', 'space.sessionFacts'])
      expect(classify(reader, meta, was, grew).verdict).toBe('EXPECTED')
    for (const reader of ['list.study', 'space.lastMeeting', 'page.note'])
      expect(classify(reader, meta, was, grew).verdict).toBe('UNEXPECTED')
  })

  it('does not expect a course with new sessions to change or drop a line it had', () => {
    const meta = { ...plain, newSessions: 1 }
    expect(
      classify('page.syllabus', meta, was, { en: ['Session 1: B', 'Session 2'] }).verdict,
    ).toBe('UNEXPECTED')
    expect(classify('page.syllabus', meta, grew, was).verdict).toBe('UNEXPECTED')
    expect(classify('calendar.ics', meta, ['b', 'a'], ['a', 'b', 'c']).verdict).toBe('UNEXPECTED')
  })

  it('expects a course with new sessions to name or count them in its lines, and nothing else', () => {
    const meta = { ...plain, newSessions: 7 }
    const before = { en: ['DESCRIPTION:Lab | DTSTART:20150328'] }
    const after = { en: ['DESCRIPTION:Lab · Session 3 | DTSTART:20150328'] }
    expect(classify('calendar.ics', meta, before, after).verdict).toBe('EXPECTED')
    expect(
      classify('page.facts', meta, ['Length: 3 sessions'], ['Length: 10 sessions']).verdict,
    ).toBe('EXPECTED')
    expect(classify('calendar.ics', plain, before, after).verdict).toBe('UNEXPECTED')
    expect(classify('list.articleCards', meta, ['3 weeks'], ['8 weeks']).verdict).toBe('UNEXPECTED')
  })

  it('expects search text to lose hand-typed list markers, in any course', () => {
    expect(classify('search.syllabus', plain, 'A\n- B', 'A\nB').verdict).toBe('EXPECTED')
    expect(classify('page.note', plain, 'A\n- B', 'A\nB').verdict).toBe('UNEXPECTED')
  })

  it('expects the timing note of an undated course to change only where the note shows', () => {
    const meta = { ...plain, undatedWords: true }
    expect(classify('page.note', meta, [], ['x']).verdict).toBe('EXPECTED')
    expect(classify('page.syllabus', meta, [], ['x']).verdict).toBe('UNEXPECTED')
  })

  it('expects nothing of other courses, nor of a course the base does not know', () => {
    expect(classify('page.facts', plain, [], ['x']).verdict).toBe('UNEXPECTED')
    expect(classify('page.facts', undefined, [], ['x']).verdict).toBe('UNEXPECTED')
  })
})

describe('onlyLabels', () => {
  const ics = (description: string, day: string) =>
    `DESCRIPTION:${description} | DTEND:${day}T150000Z | DTSTART:${day}T110000Z | SUMMARY:A`

  it('accepts a feed line that gains its session, wherever the sorted feed moved it', () => {
    const before = [ics('Lab', '20150328'), ics('Lab', '20150404')]
    const after = [ics('Lab · Session 10', '20150404'), ics('Lab · Session 9', '20150328')]
    expect(onlyLabels(before, after)).toBe(true)
    expect(onlyLabels([ics('مختبر', '1')], [ics('مختبر · الجلسة ١', '1')])).toBe(true)
  })

  it('accepts a month line that gains its session, and a changed session count', () => {
    expect(
      onlyLabels(
        ['28SaturdayMarch 2015 | 13:00 |  | '],
        ['28SaturdayMarch 2015 | 13:00 | Session 3 | '],
      ),
    ).toBe(true)
    expect(onlyLabels({ en: ['Length: 3 sessions'] }, { en: ['Length: 12 sessions'] })).toBe(true)
    expect(onlyLabels({ ar: ['المدة: ٣ جلسات'] }, { ar: ['المدة: ١٢ جلسة'] })).toBe(true)
    expect(onlyLabels(['المدة: ٦ أسابيع'], ['المدة: ٨ أسابيع'])).toBe(true)
  })

  it('refuses any other change, a renamed session, an added or dropped line', () => {
    expect(onlyLabels([ics('Lab', '20150328')], [ics('Lab · Session 1', '20150329')])).toBe(false)
    expect(onlyLabels([ics('Lab · Session 2', '1')], [ics('Lab · Session 3', '1')])).toBe(false)
    expect(onlyLabels(['Starts: Sunday, Jan 7'], ['Starts: Sunday, Jan 8'])).toBe(false)
    expect(onlyLabels(['Day 3'], ['Day 12'])).toBe(false)
    expect(onlyLabels(['a'], ['a', 'Session 2'])).toBe(false)
    expect(onlyLabels(['a', 'b'], ['a'])).toBe(false)
  })
})

describe('onlyListMarkers', () => {
  it('accepts search text whose hand-typed list markers are gone, words in the same order', () => {
    expect(onlyListMarkers('Title\n1. One\n2. Two\n- Three', 'Title\nOne\nTwo\nThree')).toBe(true)
  })

  it('lists a line once when it matches an earlier one without its marker', () => {
    expect(
      onlyListMarkers('Recap\n- Presentations\nPresentations\nEnd', 'Recap\nPresentations\nEnd'),
    ).toBe(true)
  })

  it('refuses a lost word, a new order, a marker inside a line, and no change', () => {
    expect(onlyListMarkers('- One\n- Two', 'One')).toBe(false)
    expect(onlyListMarkers('- One\n- Two', 'Two\nOne')).toBe(false)
    expect(onlyListMarkers('A - B', 'A B')).toBe(false)
    expect(onlyListMarkers('One', 'One')).toBe(false)
  })
})

describe('onlyAdds', () => {
  it('accepts lines added before, between and after the old ones', () => {
    expect(onlyAdds(['b', 'd'], ['a', 'b', 'c', 'd', 'e'])).toBe(true)
    expect(onlyAdds(undefined, ['a'])).toBe(true)
    expect(onlyAdds({ facts: ['x'], syllabus: [] }, { facts: ['x'], syllabus: ['### 1'] })).toBe(
      true,
    )
    expect(onlyAdds('a\nb', 'a\nb\nc')).toBe(true)
  })

  it('refuses a changed, dropped or moved line, and no change at all', () => {
    expect(onlyAdds(['a', 'b'], ['a', 'B', 'c'])).toBe(false)
    expect(onlyAdds(['a', 'b'], ['a'])).toBe(false)
    expect(onlyAdds(['a', 'b'], ['b', 'a', 'c'])).toBe(false)
    expect(onlyAdds(['a'], ['a'])).toBe(false)
    expect(onlyAdds({ status: 404 }, { facts: [] })).toBe(false)
  })
})

describe('toDays', () => {
  it('cuts a raw timestamp to its day, alone or ending a line', () => {
    expect(
      toDays({ facts: ['**Starts:** 2019-01-31T00:00:00.000Z', '**Type:** Lab'], d: 3 }),
    ).toEqual({ facts: ['**Starts:** 2019-01-31', '**Type:** Lab'], d: 3 })
    expect(toDays('2018-01-07T00:00:00.000Z')).toBe('2018-01-07')
  })
})

describe('compareSnapshots', () => {
  it('finds no difference between equal snapshots', () => {
    const s = snapshot({ 'page.facts': { '1': { en: ['Starts: 3 March'], ar: ['تبدأ'] } } })
    expect(compareSnapshots(s, structuredClone(s))).toEqual([])
  })

  it('reports a localized value per locale that changed, judged by the base course', () => {
    const base = snapshot(
      { 'page.note': { '1': { en: [], ar: ['ملاحظة'] } } },
      {
        '1': { ...plain, undatedWords: true },
      },
    )
    const head = snapshot({ 'page.note': { '1': { en: ['Tuesday, 19:00–21:00'], ar: ['ملاحظة'] } } })
    expect(compareSnapshots(base, head)).toEqual([
      {
        reader: 'page.note',
        course: '1',
        part: 'en',
        before: [],
        after: ['Tuesday, 19:00–21:00'],
        verdict: 'EXPECTED',
        reason: expect.any(String),
      },
    ])
  })

  it('expects a start date that went from a raw timestamp to the same day, and no other day', () => {
    const base = snapshot({
      llms: { '1': { en: { facts: ['**Starts:** 2019-01-31T00:00:00.000Z'], syllabus: [] } } },
      'list.study': { '1': '2019-01-31T00:00:00.000Z' },
    })
    const head = snapshot({
      llms: { '1': { en: { facts: ['**Starts:** 2019-01-31'], syllabus: [] } } },
      'list.study': { '1': '2019-02-01' },
    })
    expect(compareSnapshots(base, head).map((d) => [d.reader, d.verdict])).toEqual([
      ['list.study', 'UNEXPECTED'],
      ['llms', 'EXPECTED'],
    ])
  })

  it('judges added session lines against the base with its timestamps cut to days', () => {
    const base = snapshot(
      { llms: { '1': { en: { facts: ['**Starts:** 2019-01-31T00:00:00.000Z'], syllabus: [] } } } },
      { '1': { ...plain, newSessions: 1 } },
    )
    const head = snapshot({
      llms: { '1': { en: { facts: ['**Starts:** 2019-01-31'], syllabus: ['### Session 1'] } } },
    })
    expect(compareSnapshots(base, head).map((d) => d.verdict)).toEqual(['EXPECTED'])
  })

  it('flags a course or a reader missing on one side', () => {
    const base = snapshot({ 'list.study': { '1': '2019-01-31' }, llms: { '1': {} } })
    const head = snapshot({ 'list.study': { '1': '2019-01-31', '2': '2020-01-01' } })
    const diffs = compareSnapshots(base, head)
    expect(diffs.map((d) => [d.reader, d.course, d.verdict])).toEqual([
      ['list.study', '2', 'UNEXPECTED'],
      ['llms', '*', 'UNEXPECTED'],
    ])
  })
})

describe('compareSnapshots with accepted differences', () => {
  const base = snapshot({ 'page.facts': { '1': { en: ['Meets: Saturday'], ar: ['السبت'] } } })
  const head = snapshot({ 'page.facts': { '1': { en: ['Starts: 22 August'], ar: ['السبت'] } } })
  const entry: Accepted = {
    base: 'x',
    course: '1',
    reader: 'page.facts',
    part: 'en',
    reason: 'the old pattern was wrong',
  }

  it('turns the unexpected difference an entry names expected, with its reason', () => {
    expect(compareSnapshots(base, head).map((d) => d.verdict)).toEqual(['UNEXPECTED'])
    expect(compareSnapshots(base, head, [entry]).map((d) => [d.verdict, d.reason])).toEqual([
      ['EXPECTED', 'accepted: the old pattern was wrong'],
    ])
  })

  it('fails an entry that names no unexpected difference, so a stale one shows', () => {
    for (const stale of [
      { ...entry, part: 'ar' },
      { ...entry, course: '2' },
      { ...entry, reader: 'llms' },
    ])
      expect(
        compareSnapshots(base, head, [entry, stale]).map((d) => [d.verdict, d.reason]),
      ).toEqual([
        ['EXPECTED', 'accepted: the old pattern was wrong'],
        ['UNEXPECTED', 'stale accepted entry: the old pattern was wrong'],
      ])
    expect(compareSnapshots(base, structuredClone(base), [entry])).toEqual([
      expect.objectContaining({ verdict: 'UNEXPECTED', reason: expect.stringMatching(/^stale/) }),
    ])
  })

  it('applies only the entries reviewed against this base', () => {
    expect(
      compareSnapshots(base, head, [{ ...entry, base: 'other' }]).map((d) => d.verdict),
    ).toEqual(['UNEXPECTED'])
  })
})

describe('describeChange', () => {
  it('lists removed and added items of a list', () => {
    expect(describeChange(['a', 'b'], ['b', 'c'])).toEqual(['- "a"', '+ "c"'])
  })

  it('says when only the order of a list changed', () => {
    expect(describeChange(['a', 'b'], ['b', 'a'])).toEqual(['~ same items, new order'])
  })
})

describe('extractors', () => {
  it('reads a course feed without the request time or the entry ID, unfolding long lines', () => {
    const ics = [
      'BEGIN:VCALENDAR',
      'BEGIN:VEVENT',
      'UID:c4-0@cilas',
      'DTSTAMP:20261113T104455Z',
      'DTSTART:20190131T080000Z',
      'SUMMARY:A\\, B',
      'DESCRIPTION:Thematic · Ses',
      ' sion 1',
      'URL:http://localhost:3000/en/study/some-course',
      'END:VEVENT',
      'BEGIN:VEVENT',
      'UID:e1-0@cilas',
      'DTSTART:20190131T080000Z',
      'URL:http://localhost:3000/en/events/an-event',
      'END:VEVENT',
      'END:VCALENDAR',
    ].join('\r\n')
    expect(icsByCourse(ics)).toEqual({
      'some-course': ['DESCRIPTION:Thematic · Session 1 | DTSTART:20190131T080000Z | SUMMARY:A, B'],
    })
  })

  it('finds the course a link points at', () => {
    expect(courseSlugOf('/ar/study/a-course')).toBe('a-course')
    expect(courseSlugOf('http://x/en/study/a-course/llms.txt')).toBeNull()
    expect(courseSlugOf('/en/events/a')).toBeNull()
  })

  it('keeps the time facts and the syllabus lines of an llms document', () => {
    const doc = [
      '# Title',
      '## Practical facts',
      '**Type:** Thematic',
      '**Starts:** 2018-04-01',
      '**Meets:** Sunday 11:00–14:00 (Cairo)',
      '## Syllabus',
      'The syllabus may still change.',
      '### Week 1',
      'Meetings: 2',
      'A description.',
      '## Bibliography',
      '### Not a session',
    ].join('\n')
    expect(llmsTimes(doc)).toEqual({
      facts: ['**Starts:** 2018-04-01', '**Meets:** Sunday 11:00–14:00 (Cairo)'],
      syllabus: ['The syllabus may still change.', '### Week 1', 'Meetings: 2'],
    })
  })
})

describe('the timing removal rules', () => {
  it('expects Week N to become Session N, and a count of weeks a count of sessions, numbers kept', () => {
    expect(
      onlyUnits(
        ['1The BasicsWeek 1', '2EnergyWeek 2'],
        ['1The BasicsSession 1', '2EnergySession 2'],
      ),
    ).toBe(true)
    expect(onlyUnits(['Length: 11 weeks'], ['Length: 11 sessions'])).toBe(true)
    expect(onlyUnits(['### Week 3', 'Meetings: 1'], ['### Session 3', 'Meetings: 1'])).toBe(true)
    // Arabic: the label and the plural forms, in either kind of digit.
    expect(onlyUnits(['### الأسبوع 3'], ['### الجلسة 3'])).toBe(true)
    expect(onlyUnits(['الأسبوع ٣'], ['الجلسة ٣'])).toBe(true)
    expect(onlyUnits(['المدة: ١١ أسبوعًا'], ['المدة: ١١ جلسة'])).toBe(true)
    expect(onlyUnits(['المدة: ٣ أسابيع'], ['المدة: ٣ جلسات'])).toBe(true)
    expect(onlyUnits(['المدة: أسبوعان'], ['المدة: جلستان'])).toBe(true)
  })

  it('refuses a changed number, a changed title and no change', () => {
    expect(onlyUnits(['Length: 11 weeks'], ['Length: 12 sessions'])).toBe(false)
    expect(onlyUnits(['Week 3: Energy'], ['Session 3: Power'])).toBe(false)
    expect(onlyUnits(['Week 3'], ['Week 3'])).toBe(false)
    expect(onlyUnits(['### الأسبوع 3'], ['### الجلسة 4'])).toBe(false)
  })

  it('expects lines to be removed and nothing else changed', () => {
    expect(onlyRemovals(['Tuesday, 19:00–21:00'], [])).toBe(true)
    expect(onlyRemovals(['a', 'b', 'c'], ['a', 'c'])).toBe(true)
    expect(onlyRemovals(['a'], ['a'])).toBe(false)
    expect(onlyRemovals(['a'], ['b'])).toBe(false)
    expect(onlyRemovals(['a'], ['a', 'b'])).toBe(false)
  })

  it('expects a card to lose its length and keep its date', () => {
    const card = { date: '2015-12-27', dateLabel: '2015', length: '10 weeks' }
    expect(onlyLengthGone(card, { ...card, length: '' })).toBe(true)
    expect(onlyLengthGone(card, { ...card, length: '', date: '2016-01-03' })).toBe(false)
    expect(onlyLengthGone(card, { ...card, length: '9 weeks' })).toBe(false)
    expect(onlyLengthGone({ ...card, length: '' }, { ...card, length: '' })).toBe(false)
  })

  it('judges each difference by its own rule, in any course', () => {
    expect(classify('page.syllabus', plain, ['1AWeek 1'], ['1ASession 1']).reason).toMatch(/Week N/)
    expect(classify('page.note', plain, ['Hybrid for 6 weeks'], []).verdict).toBe('EXPECTED')
    expect(classify('page.note', plain, ['Hybrid'], ['Online']).verdict).toBe('UNEXPECTED')
    expect(
      classify(
        'space.sessionFacts',
        plain,
        [{ n: 1, week: false, date: null }],
        [{ n: 1, date: null }],
      ).verdict,
    ).toBe('EXPECTED')
    expect(
      classify(
        'space.sessionFacts',
        plain,
        [{ n: 1, week: false, date: null }],
        [{ n: 1, date: '2026-03-03' }],
      ).verdict,
    ).toBe('UNEXPECTED')
  })

  it('expects any time to change in a course that gained meetings, and nowhere else', () => {
    for (const reader of ['calendar.ics', 'page.facts', 'list.study', 'space.lastMeeting'])
      expect(classify(reader, { ...plain, archive: 'meetings' }, 'a', 'b').verdict).toBe('EXPECTED')
    expect(classify('list.study', plain, 'a', 'b').verdict).toBe('UNEXPECTED')
  })

  it('expects a lost length only in a course that had only a length, and only on its card', () => {
    const card = { date: '2015-12-27', dateLabel: '2015', length: '10 weeks' }
    const lost = { ...plain, archive: 'weeks-lost' as const }
    expect(classify('list.articleCards', lost, card, { ...card, length: '' }).verdict).toBe(
      'EXPECTED',
    )
    expect(classify('list.articleCards', plain, card, { ...card, length: '' }).verdict).toBe(
      'UNEXPECTED',
    )
    expect(classify('list.study', lost, '2015-12-27', '2016-01-03').verdict).toBe('UNEXPECTED')
  })

  it('takes what the head knows about a course (`archive`) when it compares', () => {
    const base = snapshot({ 'calendar.ics': { '1': ['old'] } })
    const head = snapshot(
      { 'calendar.ics': { '1': ['new'] } },
      { '1': { ...plain, archive: 'meetings' } },
    )
    expect(compareSnapshots(base, head).map((d) => d.verdict)).toEqual(['EXPECTED'])
    expect(
      compareSnapshots(base, snapshot({ 'calendar.ics': { '1': ['new'] } })).map((d) => d.verdict),
    ).toEqual(['UNEXPECTED'])
  })
})
