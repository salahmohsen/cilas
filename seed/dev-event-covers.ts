import { getPayload } from 'payload'
import { config as loadEnv } from 'dotenv'
import { orderEvents } from '../src/lib/events'

loadEnv({ path: '.env.development.local', override: true })
process.env.TYPESENSE_API_KEY = ''
const [{ default: config }, { env }] = await Promise.all([
  import('../src/payload.config'),
  import('../src/env'),
])

const local = new Set(['localhost', '127.0.0.1', '[::1]'])
const database = new URL(env.DATABASE_URL)
const storage = new URL(env.R2_ENDPOINT)
const publicStorage = new URL(env.R2_PUBLIC_URL)
if (
  process.env.NODE_ENV === 'production' ||
  !local.has(database.hostname) ||
  database.port !== '5433' ||
  !database.pathname.endsWith('_dev') ||
  !local.has(storage.hostname) ||
  !local.has(publicStorage.hostname)
)
  throw new Error(
    'Development event covers require a local development database and local image storage.',
  )

const PHOTO_IDS = [24, 180, 20, 433, 1015, 1060]
const payload = await getPayload({ config })
try {
  const { docs } = await payload.find({
    collection: 'events',
    where: { tier: { equals: 'public' } },
    pagination: false,
    depth: 0,
    overrideAccess: true,
  })
  const groups = orderEvents(docs)
  const events = [...groups.upcoming.slice(0, 8), ...groups.past.slice(0, 8)].filter(
    (event) => !event.cover_image,
  )
  console.log(
    `Local dev events: ${groups.upcoming.length} upcoming, ${groups.past.length} past; adding ${events.length} covers.`,
  )
  const photos = new Map<number, number>()
  for (let index = 0; index < events.length; index++) {
    const photo = PHOTO_IDS[index % PHOTO_IDS.length]!
    let mediaId = photos.get(photo)
    if (!mediaId) {
      const name = `dev-event-cover-${photo}`
      const existing = await payload.find({
        collection: 'media',
        where: { filename: { contains: `${name}.` } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
      mediaId = existing.docs[0]?.id
      if (!mediaId) {
        const infoResponse = await fetch(`https://picsum.photos/id/${photo}/info`, {
          signal: AbortSignal.timeout(20000),
        })
        if (!infoResponse.ok) throw new Error(`Could not read sample photo ${photo}`)
        const info = (await infoResponse.json()) as { author: string; url: string }
        const response = await fetch(`https://picsum.photos/id/${photo}/1200/800`, {
          signal: AbortSignal.timeout(20000),
        })
        if (!response.ok || !response.headers.get('content-type')?.startsWith('image/'))
          throw new Error(`Could not download sample photo ${photo}`)
        const data = Buffer.from(await response.arrayBuffer())
        if (data.length > 8 * 1024 * 1024) throw new Error('Sample photo exceeds the image limit')
        const media = await payload.create({
          collection: 'media',
          data: { alt: `Development sample photo by ${info.author}. Source: ${info.url}` },
          file: { name: `${name}.jpg`, mimetype: 'image/jpeg', data, size: data.length },
          overrideAccess: true,
        })
        mediaId = media.id
      }
      photos.set(photo, mediaId)
    }
    const event = events[index]!
    await payload.update({
      collection: 'events',
      id: event.id,
      data: { cover_image: mediaId },
      overrideAccess: true,
    })
    console.log(`Added a development cover to event ${event.id}`)
  }
} finally {
  await payload.destroy()
}
process.exit(0)
