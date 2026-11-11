// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
vi.mock('server-only', () => ({}))
import { applicantsFor } from '@/forms/applicants'

function fixture() {
  const course = {
    id: 1,
    title: 'Writing',
    cycle: { id: 7, title: 'Fall', privateData: 'must not leave server' },
    cover_image: { url: '/cover.jpg', alt: 'Cover', focalX: 30 },
    applicant_questions: [],
  }
  const find = vi.fn().mockImplementation(async ({ collection }) => ({
    docs:
      collection === 'courses'
        ? [course]
        : [
            {
              id: 10,
              form: 1,
              createdAt: '2026-11-01T12:00:00Z',
              status: 'new',
              target: { relationTo: 'cycles', value: 7 },
              submissionData: [{ field: 'name', value: 'Applicant' }],
              choices: [
                {
                  course: 1,
                  accepted: true,
                  amount: 100,
                  need_reduction: true,
                  answers: [{ name: 'why', label: 'Saved label', value: 'Own answer' }],
                },
                {
                  course: 2,
                  accepted: true,
                  amount: 200,
                  need_reduction: true,
                  answers: [{ name: 'why', label: 'Private', value: 'Another fellow answer' }],
                },
              ],
            },
          ],
  }))
  const findByID = vi
    .fn()
    .mockResolvedValue({ fields: [{ blockType: 'text', name: 'name', label: 'Your name' }] })
  return { payload: { find, findByID } as unknown as Payload, find }
}

describe('applicant data projection', () => {
  it('populates covers and exposes only display cycle metadata', async () => {
    const { payload, find } = fixture()
    const result = await applicantsFor(payload, { kind: 'admin' })
    expect(find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'courses', depth: 1 }))
    expect(result.applications[0].choices[0]).toMatchObject({
      cover: { url: '/cover.jpg', alt: 'Cover', focalX: 30 },
      cycle: { id: 7, title: 'Fall' },
      amount: 100,
      need_reduction: true,
    })
    expect(result.applications[0].choices[0].cycle).not.toHaveProperty('privateData')
  })
  it('keeps fellow choices and financial data bounded on the server', async () => {
    const { payload, find } = fixture()
    const result = await applicantsFor(payload, { kind: 'fellow', person: 42 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'courses', where: { fellows: { contains: 42 } } }),
    )
    expect(result.applications[0].choices).toHaveLength(1)
    const choice = result.applications[0].choices[0]
    expect(choice.course).toBe(1)
    expect(choice.answers).toEqual([{ name: 'why', label: 'Saved label', value: 'Own answer' }])
    expect(choice).not.toHaveProperty('amount')
    expect(choice).not.toHaveProperty('need_reduction')
    expect(JSON.stringify(result)).not.toContain('Another fellow answer')
  })
  it('does not query submissions for unauthorized viewers', async () => {
    const { payload, find } = fixture()
    expect(await applicantsFor(payload, null)).toEqual({ courses: [], applications: [] })
    expect(find).not.toHaveBeenCalled()
  })
})
