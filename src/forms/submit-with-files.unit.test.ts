vi.mock('@/env', () => ({
  env: { TURNSTILE_SECRET_KEY: '', NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' },
}))

import { File } from 'node:buffer'
import { submitWithFiles } from '@/forms/submit-with-files'
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

const multipart = (sent: unknown, files: Array<[string, File]> = []) => {
  const map = new Map<string, unknown>([
    ['payload', JSON.stringify(sent)],
    ...files.map(([name, file]): [string, unknown] => [`file:${name}`, file]),
  ])
  return { get: (key: string) => map.get(key), entries: () => map.entries() }
}

const reqOf = (
  data: ReturnType<typeof multipart>,
  findByID: ReturnType<typeof vi.fn>,
  create: ReturnType<typeof vi.fn>,
) =>
  ({
    headers: new Headers(),
    formData: async () => data,
    payload: { findByID, create, logger: { error: vi.fn() } },
  }) as unknown as PayloadRequest

describe('submitWithFiles', () => {
  it('refuses an application to a course whose deadline has passed, before storing a file', async () => {
    const findByID = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'courses'
        ? {
            id: 7,
            title: 'Writing',
            course_type: 'CORE',
            _status: 'published',
            registration: { mode: 'own', method: 'form', form: 3, deadline: '2020-01-01' },
          }
        : { id: 3, fields: [] },
    )
    const create = vi.fn()
    const res = await submitWithFiles(
      reqOf(
        multipart({ form: 3, target: { relationTo: 'courses', value: 7 }, submissionData: [] }),
        findByID,
        create,
      ),
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Writing is not open for applications.' })
    expect(create).not.toHaveBeenCalled()
  })

  it('carries a normal application through, its files named in the answers', async () => {
    const file = new File(['%PDF-1.4 tiny'], 'cv.pdf', { type: 'application/pdf' })
    const findByID = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'forms'
        ? { fields: [{ blockType: 'fileUpload', name: 'cv', required: true }] }
        : null,
    )
    const create = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'submission-files'
        ? { id: 51, url: '/api/submission-files/file-51' }
        : { id: 9 },
    )
    const res = await submitWithFiles(
      reqOf(
        multipart(
          {
            form: 3,
            submissionData: [
              { field: 'name', value: 'Mona Farid' },
              { field: 'email', value: 'mona@example.com' },
              { field: 'cv', value: 'stays until the link is written' },
            ],
          },
          [['cv', file]],
        ),
        findByID,
        create,
      ),
    )
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ ok: true })

    const writes = create.mock.calls.map((call) => (call as unknown[])[0]) as Array<{
      collection: string
      data: { submissionData?: { field: string; value: string }[] }
    }>
    expect(writes.some((w) => w.collection === 'submission-files')).toBe(true)
    const submission = writes.find((w) => w.collection === 'form-submissions')!
    const cv = submission.data.submissionData?.find((a) => a.field === 'cv')
    expect(cv?.value).toBe('http://localhost:3000/api/submission-files/file-51')
  })

  it('puts a course upload in that choice, without leaking it into shared answers', async () => {
    const question = {
      blockType: 'fileUpload',
      name: 'portfolio',
      label: 'Portfolio',
      required: true,
    }
    const course = {
      id: 7,
      title: 'Film',
      course_type: 'CORE',
      tier: 'public',
      _status: 'published',
      cycle: 2,
      registration: { mode: 'follow_cycle' },
      applicant_questions: [question],
    }
    const findByID = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'forms'
        ? { id: 3, fields: [] }
        : collection === 'cycles'
          ? { id: 2, registration: { method: 'form', form: 3 } }
          : course,
    )
    const create = vi.fn(async ({ collection }: { collection: string }) =>
      collection === 'submission-files'
        ? { id: 51, url: '/api/submission-files/file-51' }
        : { id: 9 },
    )
    const req = reqOf(
      multipart(
        {
          form: 3,
          target: { relationTo: 'cycles', value: 2 },
          submissionData: [{ field: 'name', value: 'Mona' }],
          choices: [{ course: 7, answers: [{ name: 'portfolio', value: 'untrusted link' }] }],
        },
        [
          [
            'choice:7:portfolio',
            new File(['%PDF-1.4 tiny'], 'portfolio.pdf', { type: 'application/pdf' }),
          ],
        ],
      ),
      findByID,
      create,
    )
    req.payload.find = vi.fn(async () => ({ docs: [course] })) as never
    const response = await submitWithFiles(req)
    expect(response.status).toBe(201)
    const submission = create.mock.calls.find(
      ([call]) => call.collection === 'form-submissions',
    )![0] as unknown as {
      data: {
        submissionData: { field: string; value: string }[]
        choices: { course: number; answers: { name: string; value: string }[] }[]
      }
    }
    expect(submission.data.submissionData).toEqual([{ field: 'name', value: 'Mona' }])
    expect(submission.data.choices).toEqual([
      {
        course: 7,
        answers: [
          { name: 'portfolio', value: 'http://localhost:3000/api/submission-files/file-51' },
        ],
      },
    ])
  })
})
