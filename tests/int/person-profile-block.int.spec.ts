// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import config from '@/payload.config'
import { getPublicEvent } from '@/api/events.api'
import type { ColumnsBlock, PersonProfileBlock } from '@/payload-types'

vi.mock('@/plugins/typesense', () => ({ typesenseSearch: () => (incoming: unknown) => incoming }))

const documentOf = (children: unknown[]) => ({
  root: { type: 'root', version: 1, children, direction: null, format: '', indent: 0 },
})
const profile = (person: number) => ({
  type: 'block',
  version: 2,
  fields: { blockType: 'personProfile', person },
})

describe('stored person profile blocks', () => {
  let payload: Payload
  let personId: number
  let eventId: number
  const slug = `profile-block-${randomUUID()}`

  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (url.hostname !== 'localhost' || url.port !== '5433' || url.pathname !== '/cilas_dev') {
      throw new Error('This test requires the local cilas_dev database on localhost:5433.')
    }
    payload = await getPayload({ config: await config })
    const person = await payload.create({
      collection: 'people',
      locale: 'en',
      overrideAccess: true,
      data: {
        name: 'Profile block probe',
        slug,
        visible: true,
        website: 'https://example.com',
        bio: documentOf([
          {
            type: 'paragraph',
            version: 1,
            children: [{ type: 'text', version: 1, text: 'Current public bio', format: 0 }],
          },
        ]) as never,
      },
    })
    personId = person.id
    const columns = Object.fromEntries(
      ['first', 'second', 'third', 'fourth'].map((key) => [key, documentOf([profile(personId)])]),
    )
    const event = await payload.create({
      collection: 'events',
      locale: 'en',
      overrideAccess: true,
      data: {
        title: 'Profile block probe',
        slug,
        tier: 'public',
        event_type: 'talk',
        description: documentOf([
          profile(personId),
          {
            type: 'block',
            version: 2,
            fields: { blockType: 'columns', ratio: 'equal', columnCount: '4', ...columns },
          },
        ]) as never,
      },
    })
    eventId = event.id
  })

  afterAll(async () => {
    if (eventId) await payload.delete({ collection: 'events', id: eventId, overrideAccess: true })
    if (personId) await payload.delete({ collection: 'people', id: personId, overrideAccess: true })
    if (payload) await payload.destroy()
  })

  it('populates a standalone and four nested profile selections through the public event query', async () => {
    const event = (await getPublicEvent(payload, 'en', slug))!
    const children = event.description!.root.children as unknown as {
      fields: PersonProfileBlock | ColumnsBlock
    }[]
    const fields = children[0].fields as PersonProfileBlock
    expect(fields.person).toMatchObject({
      id: personId,
      name: 'Profile block probe',
      visible: true,
      website: 'https://example.com',
    })
    expect(JSON.stringify(fields.person)).toContain('Current public bio')
    const columns = children[1].fields as ColumnsBlock
    for (const key of ['first', 'second', 'third', 'fourth'] as const) {
      const block = columns[key]!.root.children[0] as unknown as { fields: PersonProfileBlock }
      expect(block.fields.person).toMatchObject({ id: personId, visible: true })
    }
  })

  it('reads updated public profile details and respects hidden profile access', async () => {
    await payload.update({
      collection: 'people',
      id: personId,
      data: { name: 'Updated profile' },
      locale: 'en',
      overrideAccess: true,
    })
    const updated = (await getPublicEvent(payload, 'en', slug))!
    expect(JSON.stringify(updated.description)).toContain('Updated profile')
    await payload.update({
      collection: 'people',
      id: personId,
      data: { visible: false },
      overrideAccess: true,
    })
    const hidden = (await getPublicEvent(payload, 'en', slug))!
    expect(JSON.stringify(hidden.description)).not.toContain('Updated profile')
    expect(JSON.stringify(hidden.description)).not.toContain('Current public bio')
  })
})
