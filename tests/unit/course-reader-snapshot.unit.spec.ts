import { describe, expect, it } from 'vitest'

import {
  classify,
  compareSnapshots,
  courseSlugOf,
  describeChange,
  icsByCourse,
  llmsTimes,
  onlyAdds,
  toDays,
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
