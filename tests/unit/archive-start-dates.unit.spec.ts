import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  decideStartDate,
  type CurrentSchedule,
  type ResearchEntry,
} from '../../scripts/archive-start-dates'

const slot = { weekday: 'tue', start: '18:00', end: '20:00' }
const entry = (extra: Partial<ResearchEntry> = {}): ResearchEntry => ({
  id: 1,
  cycle: 'spring-2018-cairo',
  confidence: 'medium',
  start_date: '2018-04-03',
  weekday_matches_slot: true,
  slots: [slot],
  length: { weeks: 10 },
  ...extra,
})
const empty: CurrentSchedule = { start_date: null, weeks: null }

describe('decideStartDate', () => {
  it('dates a medium or high course with its start and weeks', () => {
    expect(decideStartDate(entry(), empty)).toEqual({
      id: 1,
      dated: true,
      start_date: '2018-04-03',
      weeks: 10,
      writes: { start_date: '2018-04-03', weeks: 10 },
      differs: [],
    })
    expect(decideStartDate(entry({ confidence: 'high' }), empty).dated).toBe(true)
  })

  it('skips low courses, except in a cycle the user accepted', () => {
    expect(decideStartDate(entry({ confidence: 'low' }), empty)).toMatchObject({
      dated: false,
      reason: 'confidence low',
    })
    expect(
      decideStartDate(entry({ confidence: 'low', cycle: 'winter-2020-alexandria' }), empty).dated,
    ).toBe(true)
    expect(decideStartDate(entry({ confidence: 'none', start_date: null }), empty).dated).toBe(
      false,
    )
  })

  it('turns a meeting count into weeks only when it fills whole weeks', () => {
    expect(decideStartDate(entry({ length: { meetings: 12 } }), empty)).toMatchObject({ weeks: 12 })
    expect(
      decideStartDate(entry({ slots: [slot, slot], length: { meetings: 12 } }), empty),
    ).toMatchObject({ weeks: 6 })
    expect(
      decideStartDate(entry({ slots: [slot, slot], length: { meetings: 7 } }), empty).dated,
    ).toBe(false)
  })

  it('invents no length: none or a range leaves the course undated', () => {
    expect(decideStartDate(entry({ length: null }), empty)).toMatchObject({
      dated: false,
      reason: 'no length found',
    })
    expect(decideStartDate(entry({ length: { weeks_range: [10, 12] } }), empty)).toMatchObject({
      dated: false,
      reason: 'length is a range (10 to 12 weeks)',
    })
  })

  it('skips a start that is not a slot weekday', () => {
    expect(decideStartDate(entry({ weekday_matches_slot: false }), empty).dated).toBe(false)
  })

  it('writes only what the course is missing and keeps a typed value', () => {
    const decision = decideStartDate(entry({ length: { weeks: 10, meetings: 9 } }), {
      start_date: null,
      weeks: 9,
    })
    expect(decision).toEqual({
      id: 1,
      dated: true,
      start_date: '2018-04-03',
      weeks: 9,
      writes: { start_date: '2018-04-03' },
      differs: ['weeks 9 kept (research 10)'],
    })
  })

  it('dates the 43 accepted courses of the research, less the ones with no single length', () => {
    const research: ResearchEntry[] = JSON.parse(
      readFileSync('docs/research/2026-11-course-start-dates.json', 'utf8'),
    )
    const decisions = research.map((e) => decideStartDate(e, empty))
    const skipped = decisions.filter((d) => !d.dated)
    expect(decisions.length - skipped.length).toBe(37)
    expect(
      Object.fromEntries(
        skipped.filter((d) => !d.reason.startsWith('confidence')).map((d) => [d.id, d.reason]),
      ),
    ).toEqual({
      24: 'no length found',
      30: 'no length found',
      78: 'no length found',
      195: 'no length found',
      216: 'length is a range (10 to 12 weeks)',
      224: 'length is a range (10 to 12 weeks)',
    })
  })
})
