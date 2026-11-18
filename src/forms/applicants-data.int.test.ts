import { readFile } from 'node:fs/promises'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { applicantsFor } from '@/forms/applicants'

import { applicationFixture, removeApplicationFixture } from '../../testing/application.fixture'

let f: Awaited<ReturnType<typeof applicationFixture>>
let submission: number
let cover: { id: number; url?: string | null; alt?: string | null }
beforeAll(async () => {
  f = await applicationFixture()
  const data = await readFile(new URL('../../testing/files/pixel.png', import.meta.url))
  cover = await f.payload.create({
    collection: 'media',
    data: { alt: 'Course cover' },
    file: { name: `${f.suffix}-cover.png`, mimetype: 'image/png', data, size: data.length },
    overrideAccess: true,
  })
  await f.payload.update({
    collection: 'courses',
    id: f.courses[0].id,
    data: { cover_image: cover.id },
    overrideAccess: true,
  })
  submission = (
    await f.payload.create({
      collection: 'form-submissions',
      data: {
        form: f.form.id,
        target: { relationTo: 'cycles', value: f.cycle.id },
        submissionData: [
          { field: 'name', value: 'Applicant' },
          { field: 'email', value: 'applicant@cilas.test' },
          { field: 'shared', value: 'Shared' },
        ],
        choices: [
          {
            course: f.courses[0].id,
            decision: 'pending',
            amount: 900,
            need_reduction: true,
            answers: [{ name: 'reason', value: 'Because' }],
          },
          {
            course: f.courses[1].id,
            decision: 'pending',
            amount: 900,
            need_reduction: true,
            answers: [{ name: 'reason', value: 'Because' }],
          },
        ],
      },
    })
  ).id
})
afterAll(async () => {
  if (!f) return
  if (cover) await f.payload.delete({ collection: 'media', id: cover.id })
  await removeApplicationFixture(f)
})

describe('applicant data projection', () => {
  it('shows a course cover from its media, with its alt text', async () => {
    const result = await applicantsFor(f.payload, { kind: 'admin' })
    const application = result.applications.find((a) => a.id === submission)!
    const choice = application.choices.find((c) => c.course === f.courses[0].id)!
    expect(choice.cover).toMatchObject({ src: cover.url, alt: 'Course cover' })
  })
  it('exposes only the display part of a course cycle', async () => {
    const result = await applicantsFor(f.payload, { kind: 'admin' })
    const application = result.applications.find((a) => a.id === submission)!
    expect(application.choices.map((c) => c.cycle)).toEqual([
      { id: f.cycle.id, title: f.cycle.title },
      { id: f.cycle.id, title: f.cycle.title },
    ])
  })
  it('shows a fellow only the courses they teach', async () => {
    const find = vi.spyOn(f.payload, 'find')
    await applicantsFor(f.payload, { kind: 'fellow', person: 0 })
    expect(find).toHaveBeenCalledWith(
      expect.objectContaining({ collection: 'courses', where: { fellows: { contains: 0 } } }),
    )
    find.mockRestore()
  })
  it('does not query submissions for unauthorized viewers', async () => {
    const find = vi.spyOn(f.payload, 'find')
    expect(await applicantsFor(f.payload, null)).toEqual({ courses: [], applications: [] })
    expect(find).not.toHaveBeenCalled()
    find.mockRestore()
  })
})
