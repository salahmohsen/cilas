import { http, HttpResponse } from 'msw'
import { createPayloadRequest, getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { submitWithFiles } from '@/forms/submit-with-files'
import { TURNSTILE_HEADER } from '@/lib/turnstile'
import config from '@/payload.config'
import type { Course, Cycle, Form } from '@/payload-types'

import { localServices } from '../../testing/local-services.test-utils'
import { mockNetwork } from '../../testing/msw-node.test-utils'
import { createTracker, RUN, uniq } from '../../testing/payload.fixture'

mockNetwork(
  http.post('https://challenges.cloudflare.com/turnstile/v0/siteverify', () =>
    HttpResponse.json({ success: true }),
  ),
  ...localServices,
)

const { track, cleanup } = createTracker()
let payload: Payload
let cvForm: Form
let siteForm: Form
let cycle: Cycle
let closed: Course
let film: Course

const pdfSource = [
  '%PDF-1.4',
  '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj',
  '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj',
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 10 10]>>endobj',
  'xref',
  '0 1',
  '0000000000 65535 f ',
  'trailer<</Root 1 0 R/Size 1>>',
  'startxref',
  '0',
  '%%EOF',
  '',
].join('\n')
const pdf = (name: string) => new File([pdfSource], name, { type: 'application/pdf' })

const multipart = (sent: unknown, files: Array<[string, File]> = []) => {
  const body = new FormData()
  body.set('payload', JSON.stringify(sent))
  for (const [name, file] of files) body.set(`file:${name}`, file)
  return body
}

const submit = async (body: FormData) =>
  submitWithFiles(
    await createPayloadRequest({
      config,
      request: new Request('http://localhost:3000/api/forms/submit-with-files', {
        method: 'POST',
        headers: { [TURNSTILE_HEADER]: 'passes' },
        body,
      }),
    }),
  )

const submissionsOf = async (form: number) =>
  (
    await payload.find({
      collection: 'form-submissions',
      where: { form: { equals: form } },
      depth: 0,
      overrideAccess: true,
    })
  ).docs

const storedFiles = async (filename: string) =>
  (
    await payload.find({
      collection: 'submission-files',
      where: { filename: { like: filename } },
      depth: 0,
      overrideAccess: true,
    })
  ).docs

const form = async (title: string, fields: Form['fields']) =>
  track(
    'forms',
    await payload.create({
      collection: 'forms',
      data: {
        title: uniq(title),
        confirmationType: 'redirect',
        redirect: { url: 'https://example.org/thanks' },
        fields,
      },
      overrideAccess: true,
    }),
  )

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  cvForm = await form('Files form', [
    { blockType: 'fileUpload', name: 'cv', label: 'CV', required: true, accept: ['pdf'] },
  ])
  siteForm = await form('Cycle files form', [])
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: uniq('Files place'), slug: uniq('files-place'), city: uniq('Files city') },
      overrideAccess: true,
    }),
  )
  cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: {
        season: 'fall',
        start_year: 2097,
        place: place.id,
        registration: { method: 'form', form: siteForm.id },
      },
      overrideAccess: true,
    }),
  )
  closed = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Writing',
        slug: uniq('files-writing'),
        course_type: 'CORE',
        tier: 'public',
        cycle: cycle.id,
        registration: { mode: 'own', method: 'form', form: cvForm.id, deadline: '2020-01-01' },
        _status: 'published',
      },
      overrideAccess: true,
    }),
  )
  film = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: 'Film',
        slug: uniq('files-film'),
        course_type: 'CORE',
        tier: 'public',
        cycle: cycle.id,
        registration: { mode: 'follow_cycle' },
        applicant_questions: [
          {
            blockType: 'fileUpload',
            name: 'portfolio',
            label: 'Portfolio',
            required: true,
            accept: ['pdf'],
          },
        ],
        _status: 'published',
      },
      overrideAccess: true,
    }),
  )
})

afterAll(async () => {
  for (const id of [cvForm.id, siteForm.id])
    await payload.delete({
      collection: 'form-submissions',
      where: { form: { equals: id } },
      overrideAccess: true,
    })
  await payload.delete({
    collection: 'submission-files',
    where: { filename: { like: RUN } },
    overrideAccess: true,
  })
  await cleanup(payload)
})

describe('submitWithFiles', () => {
  it('refuses an application to a course whose deadline has passed, before storing a file', async () => {
    const res = await submit(
      multipart(
        {
          form: cvForm.id,
          target: { relationTo: 'courses', value: closed.id },
          submissionData: [],
        },
        [['cv', pdf(`late-${RUN}.pdf`)]],
      ),
    )
    expect(res.status).toBe(400)
    await expect(res.json()).resolves.toEqual({ error: 'Writing is not open for applications.' })
    expect(await submissionsOf(cvForm.id)).toHaveLength(0)
    expect(await storedFiles(`late-${RUN}.pdf`)).toHaveLength(0)
  })

  it('carries a normal application through, its files named in the answers', async () => {
    const res = await submit(
      multipart(
        {
          form: cvForm.id,
          submissionData: [
            { field: 'name', value: 'Mona Farid' },
            { field: 'email', value: 'mona@example.com' },
            { field: 'cv', value: 'stays until the link is written' },
          ],
        },
        [['cv', pdf(`cv-${RUN}.pdf`)]],
      ),
    )
    expect(res.status).toBe(201)
    await expect(res.json()).resolves.toEqual({ ok: true })

    const [file] = await storedFiles(`cv-${RUN}.pdf`)
    expect(file).toBeDefined()
    track('submission-files', file!)
    const [submission] = await submissionsOf(cvForm.id)
    track('form-submissions', submission!)
    const cv = submission!.submissionData?.find((a) => a.field === 'cv')
    expect(cv?.value).toBe(`http://localhost:3000${file!.url}`)
  })

  it('puts a course upload in that choice, without leaking it into shared answers', async () => {
    const res = await submit(
      multipart(
        {
          form: siteForm.id,
          target: { relationTo: 'cycles', value: cycle.id },
          submissionData: [{ field: 'name', value: 'Mona' }],
          choices: [{ course: film.id, answers: [{ name: 'portfolio', value: 'untrusted link' }] }],
        },
        [[`choice:${film.id}:portfolio`, pdf(`portfolio-${RUN}.pdf`)]],
      ),
    )
    expect(res.status).toBe(201)
    const [file] = await storedFiles(`portfolio-${RUN}.pdf`)
    expect(file).toBeDefined()
    track('submission-files', file!)
    const [submission] = await submissionsOf(siteForm.id)
    track('form-submissions', submission!)
    expect(submission!.submissionData?.map(({ field, value }) => ({ field, value }))).toEqual([
      { field: 'name', value: 'Mona' },
    ])
    expect(
      submission!.choices?.map((choice) => ({
        course: typeof choice.course === 'object' ? choice.course.id : choice.course,
        answers: choice.answers?.map(({ name, value }) => ({ name, value })),
      })),
    ).toEqual([
      {
        course: film.id,
        answers: [{ name: 'portfolio', value: `http://localhost:3000${file!.url}` }],
      },
    ])
  })
})
