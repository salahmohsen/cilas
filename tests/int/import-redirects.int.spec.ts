// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type CollectionSlug, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { findRedirect } from '@/lib/redirects'
import { importRedirects, redirectTargets, type DocRef } from '../../migration/lib/import-redirects'

let payload: Payload

// Fixtures use the "/proberedirects-" prefix, apart from the other import specs.
const P = '/proberedirects-'
const L = { course: `${P}course.html`, cycle: `${P}cycle.html`, info: `${P}about.html` }
const UPLOAD = 'uploads/proberedirects/x.jpg'
const UPLOAD_URL = 'https://example.org/media/proberedirects-x.jpg'

const cleanup = async () => {
  const del = (collection: CollectionSlug, where: object) =>
    payload.delete({ collection, where, overrideAccess: true } as Parameters<Payload['delete']>[0]).catch(() => undefined)
  await del('redirects', { from: { like: P } })
  await del('redirects', { from: { like: '/uploads/proberedirects/' } })
  await del('courses', { legacy_url: { like: P } })
  await del('cycles', { legacy_url: { like: P } })
  await del('spaces', { slug: { equals: 'probe-redirects-space' } })
}

describe('importRedirects', () => {
  let docs: DocRef[]
  let courseId: number
  const pages = [
    { legacy_url: L.course, kind: 'course', title: 'Probe course' },
    { legacy_url: L.cycle, kind: 'cycle', title: 'Probe cycle' },
    { legacy_url: L.info, kind: 'info', title: 'Probe about' },
  ]

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    const space = await payload.create({
      collection: 'spaces',
      data: { name: 'Probe Redirects Space', slug: 'probe-redirects-space', city: 'Probeville' },
      overrideAccess: true,
    })
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2088, space: space.id, legacy_url: L.cycle },
      overrideAccess: true,
    })
    const course = await payload.create({
      collection: 'courses',
      data: { title: 'Probe Redirects Course', slug: 'probe-redirects-course', course_type: 'CORE', legacy_url: L.course, _status: 'draft' },
      draft: true,
      overrideAccess: true,
    })
    courseId = course.id as number
    docs = [
      { collection: 'courses', id: courseId, legacy_url: L.course },
      { collection: 'cycles', id: cycle.id as number, legacy_url: L.cycle },
    ]
  }, 300_000)

  afterAll(async () => {
    await cleanup()
  }, 300_000)

  const fromRow = async (from: string) =>
    (await payload.find({ collection: 'redirects', where: { from: { equals: from } }, depth: 0, overrideAccess: true })).docs

  it('creates one redirect per page with a target, and none on a re-run', async () => {
    const plans = redirectTargets(pages, docs)
    const uploads = [{ legacy_url: UPLOAD, url: UPLOAD_URL }]
    expect(await importRedirects(payload, plans, uploads)).toEqual({ created: 3, unchanged: 0, kept: 0 })
    expect(await importRedirects(payload, plans, uploads)).toEqual({ created: 0, unchanged: 3, kept: 0 })
    expect(await fromRow(L.info)).toHaveLength(0)

    const [row] = await fromRow(L.course)
    expect(row.type).toBe('301')
    expect(row.to?.reference).toEqual({ relationTo: 'courses', value: courseId })
    const [up] = await fromRow(`/${UPLOAD}`)
    expect(up.to).toMatchObject({ type: 'custom', url: UPLOAD_URL })
  }, 300_000)

  it('resolves the legacy path without .html to the course page', async () => {
    expect(await findRedirect(payload, `${P}course`)).toEqual({ url: '/study/probe-redirects-course', permanent: true })
    expect(await findRedirect(payload, `/${UPLOAD}`)).toEqual({ url: UPLOAD_URL, permanent: true })
  }, 120_000)

  it('keeps a redirect an admin edited', async () => {
    const [row] = await fromRow(L.course)
    await payload.update({
      collection: 'redirects',
      id: row.id,
      data: { to: { type: 'custom', url: '/somewhere-else' } },
      overrideAccess: true,
    })
    expect(await importRedirects(payload, redirectTargets(pages, docs), [])).toEqual({ created: 0, unchanged: 1, kept: 1 })
    expect((await fromRow(L.course))[0].to).toMatchObject({ type: 'custom', url: '/somewhere-else' })
  }, 300_000)
})
