// @vitest-environment node
import { createLocalReq, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QUESTION_NAME_RULE } from '@/forms/question-name'
import { readableChoices } from '@/forms/submission-view'
import config from '@/payload.config'

import { createTracker, uniq } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('question machine names', () => {
  let made = 0
  const courseWith = async (applicant_questions: unknown[]) =>
    track(
      'courses',
      await payload.create({
        collection: 'courses',
        draft: true,
        data: {
          title: uniq(`Question names ${++made}`),
          slug: uniq(`question-names-${made}`),
          course_type: 'CORE',
          applicant_questions,
        } as never,
      }),
    )
  const namesOf = (questions: unknown[] | null | undefined) =>
    (questions ?? []).map((q) => (q as { name: string }).name)

  it('names course questions once, from the label or the row id', async () => {
    const course = await courseWith([
      { blockType: 'textarea', label: 'Why this course? ' },
      { blockType: 'text', label: 'Why this course?' },
      { blockType: 'text', label: 'ما سبب اهتمامك؟' },
    ])
    const names = namesOf(course.applicant_questions)
    expect(names.slice(0, 2)).toEqual(['why_this_course', 'why_this_course_2'])
    expect(names[2]).toMatch(/^question_[a-z0-9]{1,6}$/)

    const [first, ...rest] = course.applicant_questions ?? []
    const edited = await payload.update({
      collection: 'courses',
      id: course.id,
      draft: true,
      data: {
        applicant_questions: [{ ...first, name: undefined, label: 'A new wording' }, ...rest],
      } as never,
    })
    expect(namesOf(edited.applicant_questions)).toEqual(names)
  })

  it('gives options values once, and shows their current labels', async () => {
    const course = await courseWith([
      {
        blockType: 'select',
        label: 'How did you hear of us?',
        options: [{ label: 'A friend' }, { label: 'صديق' }, { label: 'A friend' }],
      },
    ])
    const [question] = course.applicant_questions as unknown as Array<{
      name: string
      options: Array<{ id: string; label: string; value: string }>
    }>
    const values = question!.options.map((o) => o.value)
    expect(values[0]).toBe('a_friend')
    expect(values[1]).toMatch(/^option_[a-z0-9]{1,6}$/)
    expect(values[2]).toBe('a_friend_2')

    const relabelled = await payload.update({
      collection: 'courses',
      id: course.id,
      data: {
        applicant_questions: [
          {
            ...question,
            options: question!.options.map((o, i) =>
              i === 0 ? { id: o.id, label: 'Through a friend' } : o,
            ),
          },
        ],
      } as never,
    })
    const [after] = relabelled.applicant_questions as unknown as (typeof question)[]
    expect(after!.options.map((o) => o.value)).toEqual(values)

    const [choice] = await readableChoices(await createLocalReq({}, payload), [
      { course: course.id, answers: [{ name: question!.name, value: 'a_friend' }] },
    ] as never)
    expect(choice!.answers![0]!.value).toBe('Through a friend')
  })

  it('keeps the default questions’ names on a form', async () => {
    const form = track(
      'forms',
      await payload.create({
        collection: 'forms',
        data: {
          title: uniq('Named form'),
          confirmationType: 'message',
          confirmationMessage: {
            root: {
              type: 'root',
              version: 1,
              direction: 'ltr',
              format: '',
              indent: 0,
              children: [
                {
                  type: 'paragraph',
                  version: 1,
                  children: [{ type: 'text', version: 1, text: 'Thanks' }],
                },
              ],
            },
          },
          fields: [{ blockType: 'text', label: 'Name' }],
        } as never,
      }),
    )
    expect(namesOf(form.fields)).toEqual(['name', 'email', 'name_2'])
  })

  it('refuses a given name that breaks the rule', async () => {
    await expect(
      courseWith([{ blockType: 'text', name: 'Why this course ', label: 'Why?' }]),
    ).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([expect.objectContaining({ message: QUESTION_NAME_RULE })]),
      },
    })
  })
})
