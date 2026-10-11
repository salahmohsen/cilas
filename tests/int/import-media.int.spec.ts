// @vitest-environment node
// Boots the real config against DATABASE_URL and uploads to R2.
import path from 'node:path'
import { getPayload, type CollectionSlug, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importMedia } from '../../migration/lib/import-media'
import type { MediaJob } from '../../migration/lib/media-plan'

let payload: Payload

// Fixtures use the "/probemedia-" prefix and "Probe Media" names, apart from
// the other import specs (which run against the same database).
const P = '/probemedia-'
const K = {
  png: 'uploads/probemedia/pixel.png',
  other: 'uploads/probemedia/other.png',
  pdf: 'uploads/probemedia/tiny.pdf',
}
const FILES: Record<string, string> = {
  [K.png]: path.join(import.meta.dirname, '..', 'fixtures', 'pixel.png'),
  [K.other]: path.join(import.meta.dirname, '..', 'fixtures', 'pixel.png'),
  [K.pdf]: path.join(import.meta.dirname, '..', 'fixtures', 'tiny.pdf'),
}
const resolve = (p: string) => ({ key: p, file: FILES[p] ?? null })
const OLD_PDF = `https://www.ci-las.org/${K.pdf}`

const L = {
  person: `${P}p.html#new`,
  set: `${P}p.html#set`,
  reviewed: `${P}p.html#reviewed`,
  gone: `${P}p.html#gone`,
  course: `${P}course.html`,
  pub: `${P}pub.html`,
  newsletter: `${P}docs.html#issue`,
}

const jobs: MediaJob[] = [
  { collection: 'people', legacy_url: L.person, field: 'photo', path: K.png, alt: 'Probe Media Person' },
  { collection: 'people', legacy_url: L.set, field: 'photo', path: K.png, alt: 'Probe Media Set' },
  { collection: 'people', legacy_url: L.reviewed, field: 'photo', path: K.png, alt: 'Probe Media Reviewed' },
  { collection: 'courses', legacy_url: L.course, field: 'cover_image', path: K.png, alt: 'Probe Media Course' },
  { collection: 'partners', name: 'Probe Media Outlet', field: 'logo', path: K.png, alt: 'Probe Media Outlet' },
  { collection: 'publications', legacy_url: L.pub, field: 'print_edition_url', path: K.pdf, alt: 'Probe Media Pub' },
  { collection: 'newsletters', legacy_url: L.newsletter, field: 'body_pdf_link', path: K.pdf, alt: 'Probe Media Issue' },
  { collection: 'people', legacy_url: L.gone, field: 'photo', path: 'uploads/probemedia/nope.png', alt: 'Gone' },
]

const cleanup = async () => {
  const del = (collection: CollectionSlug, where: object) =>
    payload.delete({ collection, where, overrideAccess: true } as Parameters<Payload['delete']>[0]).catch(() => undefined)
  for (const [collection, field] of [['people', 'legacy_url'], ['courses', 'legacy_url'], ['publications', 'legacy_url'], ['newsletters', 'legacy_url']] as const) {
    await del(collection, { [field]: { like: `${P}` } })
  }
  await del('partners', { name: { equals: 'Probe Media Outlet' } })
  // Deleting a media doc deletes its R2 object.
  await del('media', { legacy_url: { like: 'uploads/probemedia/' } })
}

describe('importMedia', () => {
  let existingMediaId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    await cleanup()
    const make = (collection: CollectionSlug, data: Record<string, unknown>) =>
      payload.create({ collection, data, overrideAccess: true, ...(collection === 'courses' || collection === 'newsletters' ? { draft: true } : {}) } as Parameters<Payload['create']>[0])
    // A photo an editor chose, from a file the importer never plans.
    const chosen = await payload.create({
      collection: 'media',
      data: { alt: 'Editor choice', legacy_url: K.other },
      filePath: FILES[K.other],
      overrideAccess: true,
    })
    existingMediaId = chosen.id as number
    await make('people', { name: 'Probe Media Person', slug: 'probe-media-person', legacy_url: L.person })
    await make('people', { name: 'Probe Media Set', slug: 'probe-media-set', legacy_url: L.set, photo: existingMediaId })
    await make('people', { name: 'Probe Media Gone', slug: 'probe-media-gone', legacy_url: L.gone })
    await make('people', { name: 'Probe Media Reviewed', slug: 'probe-media-reviewed', legacy_url: L.reviewed, import_status: 'reviewed' })
    await make('courses', { title: 'Probe Media Course', slug: 'probe-media-course', course_type: 'CORE', legacy_url: L.course, _status: 'draft' })
    await make('partners', { name: 'Probe Media Outlet', slug: 'probe-media-outlet', kind: ['outlet'] })
    await make('publications', { title: 'Probe Media Pub', slug: 'probe-media-pub', kind: 'essay_collection', legacy_url: L.pub, print_edition_url: OLD_PDF })
    await make('newsletters', {
      title: 'Probe Media Issue',
      slug: 'probe-media-issue',
      issue_date: '2013-06-01',
      legacy_url: L.newsletter,
      body: {
        root: {
          type: 'root', format: '', indent: 0, version: 1, direction: 'ltr',
          children: [
            { type: 'paragraph', format: '', indent: 0, version: 1, direction: 'ltr', children: [
              { type: 'link', format: '', indent: 0, version: 3, direction: 'ltr', fields: { linkType: 'custom', url: OLD_PDF, newTab: false }, children: [{ type: 'text', version: 1, text: 'Original PDF', format: 0, detail: 0, mode: 'normal', style: '' }] },
            ] },
          ],
        },
      },
      _status: 'draft',
    })
  }, 300_000)

  afterAll(async () => {
    await cleanup()
  }, 300_000)

  const photoOf = async (legacy: string) => {
    const { docs } = await payload.find({ collection: 'people', where: { legacy_url: { equals: legacy } }, depth: 0, limit: 1, overrideAccess: true })
    return docs[0].photo as number | null
  }

  it('attaches, reuses on a second run, and leaves set and reviewed documents alone', async () => {
    const first = await importMedia(payload, jobs, resolve)
    expect(first).toMatchObject({ uploaded: 2, reused: 0, attached: 5, skippedReviewed: 1, skippedSet: 1, missing: 1, noTarget: 0 })

    const photo = await photoOf(L.person)
    expect(photo).toBeTruthy()
    expect(await photoOf(L.set)).toBe(existingMediaId)
    expect(await photoOf(L.reviewed)).toBeNull()

    const { totalDocs } = await payload.find({ collection: 'media', where: { legacy_url: { equals: K.png } }, overrideAccess: true })
    expect(totalDocs).toBe(1)
    const course = await payload.find({ collection: 'courses', where: { legacy_url: { equals: L.course } }, depth: 0, draft: true, overrideAccess: true })
    expect(course.docs[0].cover_image).toBe(photo)
    const outlet = await payload.find({ collection: 'partners', where: { name: { equals: 'Probe Media Outlet' } }, depth: 0, overrideAccess: true })
    expect(outlet.docs[0].logo).toBe(photo)

    const second = await importMedia(payload, jobs, resolve)
    expect(second).toMatchObject({ uploaded: 0, attached: 0, missing: 1 })
    expect((await payload.find({ collection: 'media', where: { legacy_url: { equals: K.png } }, overrideAccess: true })).totalDocs).toBe(1)
  }, 300_000)

  it('stores a PDF as a PDF and points the print edition and the newsletter link at it', async () => {
    const { docs } = await payload.find({ collection: 'media', where: { legacy_url: { equals: K.pdf } }, overrideAccess: true })
    expect(docs).toHaveLength(1)
    expect(docs[0].mimeType).toBe('application/pdf')
    expect(docs[0].url).toMatch(/\.pdf$/)

    const pub = await payload.find({ collection: 'publications', where: { legacy_url: { equals: L.pub } }, overrideAccess: true })
    expect(pub.docs[0].print_edition_url).toBe(docs[0].url)

    const issue = await payload.find({ collection: 'newsletters', where: { legacy_url: { equals: L.newsletter } }, draft: true, overrideAccess: true })
    expect(JSON.stringify(issue.docs[0].body)).toContain(docs[0].url as string)
    expect(JSON.stringify(issue.docs[0].body)).not.toContain('ci-las.org')

    const head = await fetch(docs[0].url as string, { method: 'HEAD' })
    expect(head.status).toBe(200)
  }, 120_000)
})

