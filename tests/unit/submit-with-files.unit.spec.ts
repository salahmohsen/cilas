// No Turnstile: the server key is unset, so the check is skipped like on a
// site without one.
vi.mock('@/env', () => ({
  env: { TURNSTILE_SECRET_KEY: '', NEXT_PUBLIC_SERVER_URL: 'http://localhost:3000' },
}))

import { File } from 'node:buffer'
import { submitWithFiles } from '@/forms/submit-with-files'
import type { PayloadRequest } from 'payload'
import { describe, expect, it, vi } from 'vitest'

/**
 * The endpoint takes one multipart request: it must refuse an application
 * whose registration has closed before it stores a single file, and it must
 * still carry a normal one through.
 */

/** What req.formData() returns, as the handler reads it. */
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
        ? { id: 7, registration: { method: 'form', deadline: '2020-01-01' } }
        : null,
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
    await expect(res.json()).resolves.toEqual({ error: 'Applications are closed.' })
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
})
