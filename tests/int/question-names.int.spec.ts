// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QUESTION_NAME_RULE } from '@/forms/question-name'
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
  it('makes a course question’s name from its label', async () => {
    const course = track(
      'courses',
      await payload.create({
        collection: 'courses',
        draft: true,
        data: {
          title: uniq('Question names'),
          slug: uniq('question-names'),
          course_type: 'CORE',
          applicant_questions: [{ blockType: 'textarea', label: 'Why this course? ' }],
        } as never,
      }),
    )
    const [question] = course.applicant_questions ?? []
    expect(question && 'name' in question ? question.name : null).toBe('why_this_course')
  })

  it('refuses a form question name that breaks the rule', async () => {
    await expect(
      payload.create({
        collection: 'forms',
        data: {
          title: uniq('Bad question name'),
          fields: [{ blockType: 'text', name: 'Why this course ', label: 'Why?' }],
        } as never,
      }),
    ).rejects.toMatchObject({
      data: {
        errors: expect.arrayContaining([expect.objectContaining({ message: QUESTION_NAME_RULE })]),
      },
    })
  })
})
