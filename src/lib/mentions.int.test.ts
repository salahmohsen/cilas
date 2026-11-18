import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { resolveRichTextReferences } from '@/lib/resolve-rich-text-references'
import config from '@/payload.config'

import { createTracker, uniq } from '../../testing/payload.fixture'

const mention = (fields: Record<string, unknown>) => ({
  type: 'inlineBlock',
  version: 1,
  fields: { blockType: 'mention', ...fields },
})
const body = (...children: unknown[]) => ({
  root: { type: 'root', children: [{ type: 'paragraph', children }] },
})

let payload: Payload
const { track, cleanup } = createTracker()

let mona: number
let published: number
let draft: number
const city = uniq('Probe')

beforeAll(async () => {
  payload = await getPayload({ config: await config })
  mona = track(
    'people',
    await payload.create({
      collection: 'people',
      data: { name: 'Mona', slug: uniq('mona') },
      overrideAccess: true,
    }),
  ).id
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Mention place', slug: uniq('mention-place'), city },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2036, place, start_date: '2036-10-04' },
      overrideAccess: true,
    }),
  ).id
  const course = (title: string, status: 'published' | 'draft') =>
    payload.create({
      collection: 'courses',
      data: {
        title,
        slug: uniq(title.toLowerCase()),
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows: [mona],
        registration: { mode: 'closed' },
        _status: status,
      },
      draft: status === 'draft',
      overrideAccess: true,
    })
  published = track('courses', await course('Plato', 'published')).id
  draft = track('courses', await course('Draft', 'draft')).id
})

afterAll(() => cleanup(payload))

describe('resolveRichTextReferences', () => {
  it('links what the reader may open and previews it', async () => {
    const out = await resolveRichTextReferences(
      payload,
      body(
        mention({ id: 'a', type: 'person', person: mona, label: 'Mona' }),
        mention({ id: 'b', type: 'course', course: published, label: 'Plato' }),
      ),
      { locale: 'en', user: null },
    )
    expect(out[`people:${mona}`]).toMatchObject({
      preview: { kind: 'person', title: 'Mona', meta: null, text: null, image: null },
    })
    expect(out[`people:${mona}`]!.href).toMatch(/^\/people\/mona-/)
    expect(out[`courses:${published}`]!.href).toMatch(/^\/study\/plato-/)
    expect(out[`courses:${published}`]!.preview.meta).toBe(`Mona · Fall 2036, ${city}`)
  })

  it('leaves drafts and missing targets out, so they stay plain words', async () => {
    const out = await resolveRichTextReferences(
      payload,
      body(
        mention({ id: 'c', type: 'course', course: draft, label: 'Draft' }),
        mention({ id: 'd', type: 'person', person: 2_147_000_000, label: 'Nobody' }),
      ),
      { locale: 'en', user: null },
    )
    expect(out).toEqual({})
  })
})
