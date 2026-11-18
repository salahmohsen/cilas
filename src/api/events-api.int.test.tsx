import { readFile } from 'node:fs/promises'

import { getPayload, type Payload } from 'payload'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { getPublicEvent } from '@/api/events.api'
import { RichTextField } from '@/components/RichTextField'
import config from '@/payload.config'

import { createTracker, uniq } from '../../testing/payload.fixture'

let payload: Payload
const { track, cleanup } = createTracker()

const upload = async (file: string, mimetype: string, alt: string) => {
  const data = await readFile(new URL(`../../testing/files/${file}`, import.meta.url))
  return track(
    'media',
    await payload.create({
      collection: 'media',
      data: { alt },
      file: {
        name: `${uniq(crypto.randomUUID().slice(0, 4))}-${file}`,
        mimetype,
        data,
        size: data.length,
      },
      overrideAccess: true,
    }),
  )
}

const eventWith = async (media: number) => {
  const slug = uniq(`upload-event-${crypto.randomUUID().slice(0, 4)}`)
  track(
    'events',
    await payload.create({
      collection: 'events',
      data: {
        _status: 'published',
        tier: 'public',
        title: 'Upload event',
        slug,
        event_type: 'screening',
        description: {
          root: {
            type: 'root',
            version: 1,
            format: '',
            direction: null,
            indent: 0,
            children: [
              { type: 'upload', version: 3, relationTo: 'media', value: media, fields: null },
            ],
          },
        },
      } as never,
      overrideAccess: true,
    }),
  )
  return slug
}

beforeAll(async () => {
  payload = await getPayload({ config: await config })
})
afterAll(async () => {
  await cleanup(payload)
  await payload.destroy()
})

describe('public event editor uploads', () => {
  it('provides enough populated media to render an image upload', async () => {
    const media = await upload('pixel.png', 'image/png', 'Screening programme')
    const event = await getPublicEvent(payload, 'en', await eventWith(media.id))
    const html = renderToStaticMarkup(<RichTextField data={event!.description} />)
    expect(html).toContain(`src="${media.url}"`)
    expect(html).toContain(`width="${media.width}"`)
    expect(html).toContain('alt="Screening programme"')
  })

  it('provides enough populated media to render a pdf upload', async () => {
    const media = await upload('tiny.pdf', 'application/pdf', 'Programme')
    const event = await getPublicEvent(payload, 'en', await eventWith(media.id))
    const html = renderToStaticMarkup(<RichTextField data={event!.description} />)
    expect(html).toContain(`href="${media.url}"`)
    expect(html).toContain(media.filename!)
  })
})
