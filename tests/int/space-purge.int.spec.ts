// @vitest-environment node
import { HeadObjectCommand, S3Client } from '@aws-sdk/client-s3'
import pg from 'pg'
import { getPayload, type Payload } from 'payload'
import sharp from 'sharp'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { env } from '@/env'
import config from '@/payload.config'
import { BUCKET_PREFIXES } from '@/lib/storage-usage'
import { CRON_LOCK, runSpacesCron } from '@/lib/space-cron'
import { purgeDeleted, RETENTION_DAYS } from '@/lib/space-purge'

import { RUN, createTracker, lockSpacesMode, uniq, uniqEmail } from './fixtures'

const NOW = new Date('2026-11-08T14:05:00Z')
const days = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString()

let payload: Payload
let unlock: () => Promise<void>
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let spaceId: number
let author: number
let reader: number
let readerAccount: number
const { track, cleanup } = createTracker()
const s3 = new S3Client({
  endpoint: env.R2_ENDPOINT,
  region: env.R2_REGION,
  forcePathStyle: true,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
})

const exists = async (doc: { filename?: string | null }) =>
  s3
    .send(
      new HeadObjectCommand({
        Bucket: env.R2_BUCKET,
        Key: `${BUCKET_PREFIXES.spaces}/${doc.filename}`,
      }),
    )
    .then(() => true)
    .catch(() => false)

const post = async (body: string, deletedDaysAgo: number | null) => {
  const row = await payload.create({
    collection: 'space-posts',
    data: {
      space: spaceId,
      author,
      kind: 'discussion',
      body,
      ...(deletedDaysAgo === null ? {} : { deleted_at: days(deletedDaysAgo) }),
    } as never,
    overrideAccess: true,
  })
  track('space-posts', row.id)
  return row.id
}

const comment = async (
  on: number,
  body: string,
  deletedDaysAgo: number | null,
  parent: number | null = null,
) => {
  const row = await payload.create({
    collection: 'space-comments',
    data: {
      space: spaceId,
      post: on,
      author,
      body,
      ...(parent ? { parent } : {}),
      ...(deletedDaysAgo === null ? {} : { deleted_at: days(deletedDaysAgo) }),
    } as never,
    overrideAccess: true,
  })
  track('space-comments', row.id)
  return row.id
}

const reaction = async (target: { post?: number; comment?: number }) => {
  const row = await payload.create({
    collection: 'space-reactions',
    data: { space: spaceId, account: readerAccount, reaction: 'agree', ...target } as never,
    overrideAccess: true,
  })
  track('space-reactions', row.id)
  return row.id
}

const file = async (target: { post?: number }) => {
  const data = await sharp({
    create: { width: 12, height: 12, channels: 3, background: '#336699' },
  })
    .png()
    .toBuffer()
  const row = await payload.create({
    collection: 'space-files',
    data: { space: spaceId, filename: `probe-f-${RUN}.png`, ...target } as never,
    file: { data, mimetype: 'image/png', name: `probe-f-${RUN}.png`, size: data.length },
    overrideAccess: true,
  })
  track('space-files', row.id)
  return row as unknown as { id: number; filename: string }
}

const has = async (collection: 'space-posts' | 'space-comments', id: number) =>
  payload
    .findByID({ collection, id, overrideAccess: true, depth: 0 })
    .then(() => true)
    .catch(() => false)

describe('space purge', () => {
  beforeAll(async () => {
    unlock = await lockSpacesMode()
    payload = await getPayload({ config: await (config as never as Promise<typeof config>) })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'
    const mk = async (name: string) => {
      const p = await payload.create({
        collection: 'people',
        data: { name, slug: uniq(name.toLowerCase()) },
        overrideAccess: true,
      })
      track('people', p.id)
      const u = await payload.create({
        collection: 'users',
        data: {
          email: uniqEmail(name.toLowerCase()),
          password: 'probe-probe',
          roles: ['member'],
          person: p.id,
        },
        overrideAccess: true,
      })
      track('users', u.id)
      return { person: p.id, account: u.id }
    }
    const a = await mk('Purge-Author')
    const r = await mk('Purge-Reader')
    author = a.person
    reader = r.person
    readerAccount = r.account
    const space = await payload.create({
      collection: 'spaces',
      data: { kind: 'community' },
      overrideAccess: true,
    })
    track('spaces', space.id)
    spaceId = space.id
  }, 600_000)

  afterAll(async () => {
    await cleanup(payload)
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: modeBefore },
      overrideAccess: true,
    })
    await payload.destroy()
    await unlock()
  })

  it('keeps 30 days and removes what is older, files and rows both', async () => {
    expect(RETENTION_DAYS).toBe(30)
    const old = await post('older than thirty days', 31)
    const edge = await post('just inside thirty days', 29)
    const live = await post('not deleted', null)
    const oldFile = await file({ post: old })
    const edgeFile = await file({ post: edge })
    expect(await exists(oldFile)).toBe(true)

    const counts = await purgeDeleted(payload, NOW)
    expect(counts.posts).toBeGreaterThanOrEqual(1)
    expect(await has('space-posts', old)).toBe(false)
    expect(await has('space-posts', edge)).toBe(true)
    expect(await has('space-posts', live)).toBe(true)
    expect(await exists(oldFile)).toBe(false) // the stored object went too
    expect(await exists(edgeFile)).toBe(true)
    const left = await payload.find({
      collection: 'space-files',
      where: { id: { in: [oldFile.id, edgeFile.id] } },
      overrideAccess: true,
    })
    expect(left.docs.map((d) => d.id)).toEqual([edgeFile.id])
  })

  it('removes the dependents of a purged post: reactions, answers, votes and bell rows', async () => {
    const old = await post('old with dependents', 40)
    const liveOther = await post('keeps its own', null)
    const r1 = await reaction({ post: old })
    const rOther = await reaction({ post: liveOther })
    const rsvp = await payload.create({
      collection: 'space-rsvps',
      data: { space: spaceId, account: readerAccount, post: old, status: 'going' } as never,
      overrideAccess: true,
    })
    track('space-rsvps', rsvp.id)
    const link = `/spaces/community/${spaceId}/posts/${old}`
    const bell = async (path: string) => {
      const row = await payload.create({
        collection: 'notifications',
        data: { recipient: readerAccount, kind: 'comment', title: 'T', link: path } as never,
        overrideAccess: true,
      })
      track('notifications', row.id)
      return row.id
    }
    const plain = await bell(link)
    const withLocale = await bell(`/en${link}`)
    const otherPost = await bell(`/spaces/community/${spaceId}/posts/${liveOther}`)
    const prefix = await bell(`/spaces/community/${spaceId}/posts/${old}9`) // another post's id

    await purgeDeleted(payload, NOW)
    const gone = async (collection: string, id: number) =>
      (
        await payload.find({
          collection: collection as never,
          where: { id: { equals: id } },
          overrideAccess: true,
        })
      ).docs.length === 0
    expect(await gone('space-reactions', r1)).toBe(true)
    expect(await gone('space-rsvps', rsvp.id)).toBe(true)
    expect(await gone('notifications', plain)).toBe(true)
    expect(await gone('notifications', withLocale)).toBe(true)
    expect(await gone('space-reactions', rOther)).toBe(false)
    expect(await gone('notifications', otherPost)).toBe(false)
    expect(await gone('notifications', prefix)).toBe(false)
  })

  it('removes a deleted comment with no replies and keeps the post', async () => {
    const parent = await post('thread', null)
    const gone = await comment(parent, ' ', 35)
    const fresh = await comment(parent, ' ', 3)
    const rx = await reaction({ comment: gone })
    await purgeDeleted(payload, NOW)
    expect(await has('space-comments', gone)).toBe(false)
    expect(await has('space-comments', fresh)).toBe(true)
    expect(await has('space-posts', parent)).toBe(true)
    const left = await payload.find({
      collection: 'space-reactions',
      where: { id: { equals: rx } },
      overrideAccess: true,
    })
    expect(left.docs).toHaveLength(0)
  })

  it('keeps a placeholder that still has live replies, and the replies intact', async () => {
    const thread = await post('placeholder thread', null)
    const top = await comment(thread, ' ', 50) // deleted long ago, kept for its reply
    const reply = await comment(thread, 'a live reply', null, top)
    const topReaction = await reaction({ comment: top })
    const tomb = await post(' ', 60) // a deleted post that kept its answers
    const liveAnswer = await comment(tomb, 'answer on the deleted post', null)
    const tombFile = await file({ post: tomb })

    await purgeDeleted(payload, NOW)
    // The rows stay so the live replies keep their place ...
    expect(await has('space-comments', top)).toBe(true)
    expect(await has('space-comments', reply)).toBe(true)
    expect(await has('space-posts', tomb)).toBe(true)
    expect(await has('space-comments', liveAnswer)).toBe(true)
    const kept = await payload.findByID({
      collection: 'space-comments',
      id: reply,
      overrideAccess: true,
    })
    expect(kept.body).toBe('a live reply')
    expect(typeof kept.parent === 'object' ? kept.parent?.id : kept.parent).toBe(top)
    // ... but what hung on them is gone.
    expect(await exists(tombFile)).toBe(false)
    const rx = await payload.find({
      collection: 'space-reactions',
      where: { id: { equals: topReaction } },
      overrideAccess: true,
    })
    expect(rx.docs).toHaveLength(0)

    // Once the reply is gone, a later run takes the placeholder too.
    await payload.delete({ collection: 'space-comments', id: reply, overrideAccess: true })
    await payload.delete({ collection: 'space-comments', id: liveAnswer, overrideAccess: true })
    await purgeDeleted(payload, NOW)
    expect(await has('space-comments', top)).toBe(false)
    expect(await has('space-posts', tomb)).toBe(false)
  })

  it('takes a whole expired thread in one run, replies first', async () => {
    const thread = await post('old whole thread', 45)
    const top = await comment(thread, ' ', 45)
    const reply = await comment(thread, ' ', 45, top)
    await purgeDeleted(payload, NOW)
    expect(await has('space-comments', reply)).toBe(false)
    expect(await has('space-comments', top)).toBe(false)
    expect(await has('space-posts', thread)).toBe(false)
  })

  it('is safe to run again, works in batches, and runs while the switch is off', async () => {
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'off' },
      overrideAccess: true,
    })
    const ids = [await post('b1', 33), await post('b2', 33), await post('b3', 33)]
    const first = await purgeDeleted(payload, NOW, { batch: 2 })
    expect(first.posts).toBe(2)
    const second = await purgeDeleted(payload, NOW, { batch: 2 })
    expect(second.posts).toBeGreaterThanOrEqual(1)
    const third = await purgeDeleted(payload, NOW, { batch: 2 })
    expect(third).toEqual({
      comments: 0,
      posts: 0,
      files: 0,
      reactions: 0,
      votes: 0,
      rsvps: 0,
      notifications: 0,
    })
    for (const id of ids) expect(await has('space-posts', id)).toBe(false)
  })

  describe('the hourly job', () => {
    it('purges only in the Cairo 03:00 hour, and says busy while another run holds the lock', async () => {
      const old = await post('purged by the job', 40)
      const other = new pg.Client({ connectionString: process.env.DATABASE_URL })
      await other.connect()
      try {
        await other.query('SELECT pg_advisory_lock($1)', [CRON_LOCK])
        expect(await runSpacesCron(payload, new Date('2026-11-09T01:05:00Z'))).toEqual({
          busy: true,
        })
        expect(await has('space-posts', old)).toBe(true)
      } finally {
        await other.query('SELECT pg_advisory_unlock($1)', [CRON_LOCK])
        await other.end()
      }
      // 14:05Z is 16:05 Cairo: digests are due, the purge is not.
      const afternoon = await runSpacesCron(payload, NOW, { pause: 0 })
      expect(afternoon).toMatchObject({ purge: 'skipped' })
      expect(await has('space-posts', old)).toBe(true)
      // 01:05Z is 03:05 Cairo.
      const night = await runSpacesCron(payload, new Date('2026-11-09T01:05:00Z'), { pause: 0 })
      expect(night).toMatchObject({ digests: { skipped: 'hour' } })
      expect(typeof (night as { purge: unknown }).purge).toBe('object')
      expect(await has('space-posts', old)).toBe(false)
    })

    it('lets the next call run once the lock is free again', async () => {
      const result = await runSpacesCron(payload, NOW, { pause: 0 })
      expect((result as { busy?: boolean }).busy).toBeUndefined()
    })
  })

  it('knows the reader', () => {
    expect(reader).toBeGreaterThan(0)
  })
})
