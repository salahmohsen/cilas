import { resolveApplicationTarget } from '@/forms/application-target'
import type { Reader } from '@/lib/reader'
import { describe, expect, it } from 'vitest'

import { checkApplication } from '@/forms/application-validation'
import type { ApplicationChoice } from '@/forms/application-input'
import type { Course, Cycle } from '@/payload-types'

const now = new Date('2030-06-15T12:00:00Z')
const cycle: Cycle = {
  id: 10,
  title: 'Summer cycle',
  season: 'summer',
  start_year: 2030,
  place: 1,
  registration: { method: 'form', form: 20, deadline: '2030-07-01' },
  pricing: [
    {
      course_types: ['CORE'],
      pricing: { options: [{ amount: 100, default: true }, { amount: 200 }] },
    },
  ],
  createdAt: '',
  updatedAt: '',
}
const course = (data: Partial<Course> = {}): Course => ({
  id: 1,
  title: 'Writing',
  slug: 'writing',
  course_type: 'CORE',
  session_unit: 'week',
  tier: 'public',
  cycle: cycle.id,
  registration: { mode: 'follow_cycle' },
  _status: 'published',
  applicant_questions: [
    { blockType: 'text', name: 'reason', label: 'Why writing?', required: true },
  ],
  createdAt: '',
  updatedAt: '',
  ...data,
})
const choice = (data: Partial<ApplicationChoice> = {}): ApplicationChoice => ({
  course: 1,
  amount: 100,
  answers: [{ name: 'reason', label: 'Client label', value: 'To write' }],
  ...data,
})
const check = (courses = [course()], choices = [choice()], reader: Reader = null) =>
  checkApplication(
    { form: 20, target: { relationTo: 'cycles', value: 10 }, choices },
    {
      destination: resolveApplicationTarget({ kind: 'cycles', target: cycle }),
      courses,
    },
    reader,
    false,
    now,
  )

describe('cycle application validation', () => {
  it.each([
    ['closed course', { registration: { mode: 'closed' } }],
    ['close_early passed', { registration: { mode: 'follow_cycle', close_early: '2030-06-14' } }],
    ['own course in a cycle form', { registration: { mode: 'own', method: 'form', form: 20 } }],
    ['unpublished course', { _status: 'draft' }],
    ['course in another cycle', { cycle: 11 }],
    ['owner course', { tier: 'owner' }],
    ['community course for a public submitter', { tier: 'community' }],
  ] satisfies [string, Partial<Course>][])('refuses a %s', (_, data) => {
    expect(check([course(data)])).toEqual({ error: 'Writing is no longer open for applications.' })
  })

  it('allows community courses to a signed-in reader', () => {
    expect(
      check([course({ tier: 'community' })], [choice()], { id: 4 } as NonNullable<Reader>),
    ).toHaveProperty('choices')
  })

  it('requires an answer only for a chosen course', () => {
    expect(check([course()], [choice({ answers: [] })])).toEqual({
      error: 'Answer “Why writing?” for Writing.',
    })
    expect(check([course(), course({ id: 2 })])).toHaveProperty('choices')
  })

  it('rejects an answer for an unticked course', () => {
    const other = course({
      id: 2,
      applicant_questions: [{ blockType: 'text', name: 'portfolio', label: 'Portfolio' }],
    })
    expect(
      check(
        [course(), other],
        [choice({ answers: [{ name: 'portfolio', value: 'Other course answer' }] })],
      ),
    ).toHaveProperty(
      'error',
      'Remove the unrecognized or repeated answer for Writing and try again.',
    )
  })

  it.each([50, null, undefined])('rejects an amount outside the options: %s', (amount) => {
    expect(check([course()], [choice({ amount })])).toHaveProperty(
      'error',
      'Choose one of the contribution amounts for Writing.',
    )
  })

  it('accepts zero as an option, but requires an empty amount without options', () => {
    expect(
      check(
        [course({ pricing_override: { options: [{ amount: 0, default: true }] } })],
        [choice({ amount: 0 })],
      ),
    ).toHaveProperty('choices')
    const unpriced = course({ course_type: 'LAB' })
    expect(check([unpriced], [choice({ amount: null })])).toHaveProperty('choices')
    expect(check([unpriced])).toHaveProperty('error')
  })

  it('sets labels from the current question without mutating the submitted answer', () => {
    const sent = choice()
    expect(check([course()], [sent])).toMatchObject({
      choices: [{ answers: [{ name: 'reason', label: 'Why writing?', value: 'To write' }] }],
    })
    expect(sent.answers?.[0].label).toBe('Client label')
  })

  it('rejects duplicate courses', () => {
    expect(check([course()], [choice(), choice()])).toEqual({ error: 'Choose Writing only once.' })
  })

  it('requires at least one choice and the cycle form', () => {
    expect(check([], [])).toEqual({ error: 'Choose at least one course.' })
    expect(
      checkApplication(
        { form: 99, target: { relationTo: 'cycles', value: 10 }, choices: [choice()] },
        {
          destination: resolveApplicationTarget({ kind: 'cycles', target: cycle }),
          courses: [course()],
        },
      ),
    ).toHaveProperty(
      'error',
      'This form is not the registration form of what it names. Reload the application page.',
    )
  })

  it('allows need-based deductions only when the resolved price enables them', () => {
    expect(check([course()], [choice({ need_reduction: true })])).toHaveProperty(
      'error',
      'Writing does not offer need-based deductions.',
    )
    expect(
      check(
        [
          course({
            pricing_override: {
              options: [{ amount: 100, default: true }],
              need_based_deductions: true,
            },
          }),
        ],
        [choice({ need_reduction: true })],
      ),
    ).toHaveProperty('choices')
  })
})

it('refuses a course target with empty choices even for local creation', () => {
  const target = course({ registration: { mode: 'own', method: 'form', form: 20 } })
  expect(
    checkApplication(
      { form: 20, target: { relationTo: 'courses', value: target.id }, choices: [] },
      {
        destination: resolveApplicationTarget({ kind: 'courses', target }, cycle),
        courses: [target],
      },
      null,
      true,
      now,
    ),
  ).toEqual({ error: 'Choose only Writing on this application.' })
})
