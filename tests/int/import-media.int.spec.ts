// @vitest-environment node
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { getPayload, type CollectionSlug, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { importMedia } from '../../migration/lib/import-media'
import type { MediaJob } from '../../migration/lib/media-plan'
import { RUN, uniq } from './fixtures'

let payload: Payload

const P = `/probemedia-${RUN}-`
const UPLOAD_DIR = `uploads/probemedia-${RUN}`
const OUTLET = `Probe Media Outlet ${RUN}`
const PRESS = `Probe Media Press ${RUN}`
const K = {
  png: `${UPLOAD_DIR}/pixel.png`,
  other: `${UPLOAD_DIR}/other.png`,
  pdf: `${UPLOAD_DIR}/tiny.pdf`,
}
// Media filenames are unique, so each run uploads its own copy of a fixture
// under a name no earlier (or interrupted) run used.
const TMP = mkdtempSync(path.join(tmpdir(), 'probemedia-'))
const copyOf = (fixture: string, as: string): string => {
  const ext = path.extname(fixture)
  const to = path.join(TMP, `${as}-${RUN}${ext}`)
  copyFileSync(path.join(import.meta.dirname, '..', 'fixtures', fixture), to)
  return to
}
const FILES: Record<string, string> = {
  [K.png]: copyOf('pixel.png', 'pixel'),
  [K.other]: copyOf('pixel.png', 'other'),
  [K.pdf]: copyOf('tiny.pdf', 'tiny'),
}
const resolve = (p: string) => ({ key: p, file: FILES[p] ?? null })
const OLD_PDF = `https://www.ci-las.org/${K.pdf}`

const L = {
  person: `${P}p.html#new`,
  set: `${P}p.html#set`,
  gone: `${P}p.html#gone`,
  course: `${P}course.html`,
  pub: `${P}pub.html`,
  newsletter: `${P}docs.html#issue`,
}

const jobs: MediaJob[] = [
  {
    collection: 'people',
    legacy_url: L.person,
    field: 'photo',
    path: K.png,
    alt: 'Probe Media Person',
  },
  { collection: 'people', legacy_url: L.set, field: 'photo', path: K.png, alt: 'Probe Media Set' },
  {
    collection: 'courses',
    legacy_url: L.course,
    field: 'cover_image',
    path: K.png,
    alt: 'Probe Media Course',
  },
  {
    collection: 'press',
    name: OUTLET,
    field: 'outlet.logo',
    path: K.png,
    alt: 'Probe Media Outlet',
  },
  {
    collection: 'publications',
    legacy_url: L.pub,
    field: 'print_edition_url',
    path: K.pdf,
    alt: 'Probe Media Pub',
  },
  {
    collection: 'newsletters',
    legacy_url: L.newsletter,
    field: 'body_pdf_link',
    path: K.pdf,
    alt: 'Probe Media Issue',
  },
  {
    collection: 'people',
    legacy_url: L.gone,
    field: 'photo',
    path: `${UPLOAD_DIR}/nope.png`,
    alt: 'Gone',
  },
]

const cleanup = async () => {
  const del = (collection: CollectionSlug, where: object) =>
    payload
      .delete({ collection, where, overrideAccess: true } as Parameters<Payload['delete']>[0])
      .catch(() => undefined)
  for (const [collection, field] of [
    ['people', 'legacy_url'],
    ['courses', 'legacy_url'],
    ['publications', 'legacy_url'],
    ['newsletters', 'legacy_url'],
  ] as const) {
    await del(collection, { [field]: { like: `${P}` } })
  }
  await del('press', { title: { equals: PRESS } })
  // Deleting a media doc deletes its R2 object.
  await del('media', { legacy_url: { like: `${UPLOAD_DIR}/` } })
}

describe('importMedia', () => {
  let existingMediaId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const make = (collection: CollectionSlug, data: Record<string, unknown>) =>
      payload.create({
        collection,
        data,
        overrideAccess: true,
        ...(collection === 'courses' || collection === 'newsletters' ? { draft: true } : {}),
      } as Parameters<Payload['create']>[0])
    // A photo an editor chose, from a file the importer never plans.
    const chosen = await payload.create({
      collection: 'media',
      data: { alt: 'Editor choice', legacy_url: K.other },
      filePath: FILES[K.other],
      overrideAccess: true,
    })
    existingMediaId = chosen.id as number
    await make('people', {
      name: 'Probe Media Person',
      slug: uniq('probe-media-person'),
      legacy_url: L.person,
    })
    await make('people', {
      name: 'Probe Media Set',
      slug: uniq('probe-media-set'),
      legacy_url: L.set,
      photo: existingMediaId,
    })
    await make('people', {
      name: 'Probe Media Gone',
      slug: uniq('probe-media-gone'),
      legacy_url: L.gone,
    })
    await make('courses', {
      title: 'Probe Media Course',
      slug: uniq('probe-media-course'),
      course_type: 'CORE',
      legacy_url: L.course,
      _status: 'draft',
    })
    await make('press', {
      kind: 'coverage',
      title: PRESS,
      outlet: { name: OUTLET },
      links: [{ url: 'https://example.com/probe-media' }],
    })
    await make('publications', {
      title: 'Probe Media Pub',
      slug: uniq('probe-media-pub'),
      kind: 'essay_collection',
      _status: 'published',
      legacy_url: L.pub,
      print_edition_url: OLD_PDF,
    })
    await make('newsletters', {
      title: 'Probe Media Issue',
      slug: uniq('probe-media-issue'),
      issue_date: '2013-06-01',
      legacy_url: L.newsletter,
      body: {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          version: 1,
          direction: 'ltr',
          children: [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              direction: 'ltr',
              children: [
                {
                  type: 'link',
                  format: '',
                  indent: 0,
                  version: 3,
                  direction: 'ltr',
                  fields: { linkType: 'custom', url: OLD_PDF, newTab: false },
                  children: [
                    {
                      type: 'text',
                      version: 1,
                      text: 'Original PDF',
                      format: 0,
                      detail: 0,
                      mode: 'normal',
                      style: '',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      _status: 'draft',
    })
  }, 300_000)

  afterAll(async () => {
    await cleanup()
    rmSync(TMP, { recursive: true, force: true })
  }, 300_000)

  const photoOf = async (legacy: string) => {
    const { docs } = await payload.find({
      collection: 'people',
      where: { legacy_url: { equals: legacy } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    return docs[0].photo as number | null
  }

  it('attaches, reuses on a second run, and leaves set documents alone', async () => {
    const first = await importMedia(payload, jobs, resolve)
    expect(first).toMatchObject({
      uploaded: 2,
      reused: 0,
      attached: 5,
      skippedSet: 1,
      missing: 1,
      noTarget: 0,
    })

    const photo = await photoOf(L.person)
    expect(photo).toBeTruthy()
    expect(await photoOf(L.set)).toBe(existingMediaId)

    const { totalDocs } = await payload.find({
      collection: 'media',
      where: { legacy_url: { equals: K.png } },
      overrideAccess: true,
    })
    expect(totalDocs).toBe(1)
    const course = await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: L.course } },
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
    expect(course.docs[0].cover_image).toBe(photo)
    const outlet = await payload.find({
      collection: 'press',
      where: { title: { equals: PRESS } },
      depth: 0,
      overrideAccess: true,
    })
    expect(outlet.docs[0].outlet?.logo).toBe(photo)

    const second = await importMedia(payload, jobs, resolve)
    expect(second).toMatchObject({ uploaded: 0, attached: 0, missing: 1 })
    expect(
      (
        await payload.find({
          collection: 'media',
          where: { legacy_url: { equals: K.png } },
          overrideAccess: true,
        })
      ).totalDocs,
    ).toBe(1)
  }, 300_000)

  it('stores a PDF as a PDF and points the print edition and the newsletter link at it', async () => {
    const { docs } = await payload.find({
      collection: 'media',
      where: { legacy_url: { equals: K.pdf } },
      overrideAccess: true,
    })
    expect(docs).toHaveLength(1)
    expect(docs[0].mimeType).toBe('application/pdf')
    expect(docs[0].url).toMatch(/\.pdf$/)

    const pub = await payload.find({
      collection: 'publications',
      where: { legacy_url: { equals: L.pub } },
      overrideAccess: true,
    })
    expect(pub.docs[0].print_edition_url).toBe(docs[0].url)

    const issue = await payload.find({
      collection: 'newsletters',
      where: { legacy_url: { equals: L.newsletter } },
      draft: true,
      overrideAccess: true,
    })
    expect(JSON.stringify(issue.docs[0].sections)).toContain(docs[0].url as string)
    expect(JSON.stringify(issue.docs[0].sections)).not.toContain('ci-las.org')

    const head = await fetch(docs[0].url as string, { method: 'HEAD' })
    expect(head.status).toBe(200)
  }, 120_000)
})
