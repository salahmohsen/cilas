import type { Payload, Where } from 'payload'

import { isAdminUser, personOf } from '@/access'
import { getEmailSettings } from '@/emails/settings'
import { digestMail, type MailItem } from '@/emails/space-mail'
import { relId } from '@/lib/relation'
import { wait } from '@/lib/resend'
import { unsubscribeUrl } from '@/lib/space-email-token'
import {
  digestsDueAt,
  hourStart,
  PERIOD_MS,
  type DigestFrequency,
} from '@/lib/space-email-schedule'
import {
  clip,
  postUrl,
  sendSpaceMail,
  settingsUrl,
  spaceMeta,
  spacesUrl,
  type MetaCache,
} from '@/lib/space-email'
import { loadPrefs, prefsOf, type SpaceEmailPrefs } from '@/lib/space-email-prefs'
import type { SpaceRef } from '@/lib/space-ref'
import { mode, spacesSettings } from '@/lib/spaces'
import type { User } from '@/payload-types'

const SHOWN = 10
const FETCHED = 30
const PAUSE_MS = 200
/** A late run still reaches back to the last digest, but never a whole extra period. */
const SLACK_MS = 60 * 60 * 1000

type Entry = { id: number; postId: number; space: number; text: string; at: number }

export type DigestContent = {
  mentions: Entry[]
  replies: Entry[]
  posts: Entry[]
  more: number
}

/** A member who can read no space is refused outright by the rule: that is an empty answer here. */
const readable = <T extends { docs: unknown[] }>(read: Promise<T>) =>
  read.catch((error) => {
    if ((error as { status?: number }).status === 403)
      return { docs: [], totalDocs: 0 } as unknown as T & { totalDocs: number }
    throw error
  })

const byNewest = (a: Entry, b: Entry) => b.at - a.at

/**
 * What a member missed between `since` and `until`: mentions of them, replies
 * to their posts and comments, and new posts. Every read runs as the member
 * with access rules on, so a space they cannot read now (Spaces switch, a
 * withdrawn place, the introduction gate) adds nothing. Their own content and
 * deleted content are left out; an announcement already emailed at once is not
 * repeated unless it mentions them.
 */
export const digestContent = async (
  payload: Payload,
  user: User,
  since: Date,
  until: Date,
): Promise<DigestContent> => {
  const person = personOf(user)
  const empty = { mentions: [], replies: [], posts: [], more: 0 }
  if (person === null) return empty
  const context: Record<string, unknown> = {}
  const window: Where[] = [
    { createdAt: { greater_than: since.toISOString() } },
    { createdAt: { less_than_equal: until.toISOString() } },
    { deleted_at: { exists: false } },
    { author: { not_equals: person } },
  ]
  const marker = `](/people/${person})`
  const read = {
    user,
    context,
    overrideAccess: false as const,
    depth: 0,
    limit: FETCHED,
    sort: '-createdAt',
  }
  const [posts, mentioned, replied] = await Promise.all([
    readable(payload.find({ ...read, collection: 'space-posts', where: { and: window } })),
    readable(
      payload.find({
        ...read,
        collection: 'space-comments',
        where: { and: [...window, { body: { contains: marker } }] },
      }),
    ),
    readable(
      payload.find({
        ...read,
        collection: 'space-comments',
        where: {
          and: [
            ...window,
            {
              or: [{ 'post.author': { equals: person } }, { 'parent.author': { equals: person } }],
            },
          ],
        },
      }),
    ),
  ])

  const mentions = new Map<string, Entry>()
  const replies = new Map<string, Entry>()
  const fresh = new Map<string, Entry>()
  for (const c of mentioned.docs)
    mentions.set(`c${c.id}`, {
      id: c.id,
      postId: relId(c.post) as number,
      space: relId(c.space) as number,
      text: clip(c.body),
      at: Date.parse(c.createdAt),
    })
  for (const c of replied.docs)
    if (!mentions.has(`c${c.id}`))
      replies.set(`c${c.id}`, {
        id: c.id,
        postId: relId(c.post) as number,
        space: relId(c.space) as number,
        text: clip(c.body),
        at: Date.parse(c.createdAt),
      })
  for (const p of posts.docs) {
    const entry = {
      id: p.id,
      postId: p.id,
      space: relId(p.space) as number,
      text: (p.event_title?.trim() || clip(p.body)) as string,
      at: Date.parse(p.createdAt),
    }
    if (p.body.includes(marker)) mentions.set(`p${p.id}`, entry)
    else if (!(p.kind === 'announcement' && p.announcement_email_sent)) fresh.set(`p${p.id}`, entry)
  }
  const sorted = (m: Map<string, Entry>) => [...m.values()].sort(byNewest)
  const lists = { mentions: sorted(mentions), replies: sorted(replies), posts: sorted(fresh) }
  // A query that hit its limit hides more rows than it returned.
  const hidden = [posts, mentioned, replied].reduce(
    (n, r) => n + Math.max(0, r.totalDocs - r.docs.length),
    0,
  )
  const surplus = (Object.values(lists) as Entry[][]).reduce(
    (n, l) => n + Math.max(0, l.length - SHOWN),
    0,
  )
  return {
    mentions: lists.mentions.slice(0, SHOWN),
    replies: lists.replies.slice(0, SHOWN),
    posts: lists.posts.slice(0, SHOWN),
    more: surplus + hidden,
  }
}

export const digestSize = (c: DigestContent) =>
  c.mentions.length + c.replies.length + c.posts.length

/**
 * Takes the member's digest for this hour, or says someone else has. One
 * statement does the check and the write, so two runs (a retry, two app
 * instances) cannot both win. The row is made on a first digest.
 */
export const claimDigest = async (
  payload: Payload,
  account: number,
  now: Date,
): Promise<boolean> => {
  const result = await payload.db.pool.query(
    `INSERT INTO space_preferences (account_id, digest_sent_at)
     VALUES ($1, $2)
     ON CONFLICT (account_id) DO UPDATE SET digest_sent_at = EXCLUDED.digest_sent_at, updated_at = now()
     WHERE space_preferences.digest_sent_at IS NULL OR space_preferences.digest_sent_at < $3
     RETURNING id`,
    [account, now.toISOString(), hourStart(now).toISOString()],
  )
  return result.rowCount === 1
}

/** Gives the claim back after a failed send, so a later run may try again. */
const releaseDigest = (payload: Payload, account: number, now: Date, previous: Date | null) =>
  payload.db.pool.query(
    `UPDATE space_preferences SET digest_sent_at = $3 WHERE account_id = $1 AND digest_sent_at = $2`,
    [account, now.toISOString(), previous?.toISOString() ?? null],
  )

export type DigestRun = {
  /** Why nothing was sent: the Spaces switch is off, or this is not the Cairo digest hour. */
  skipped?: 'off' | 'hour'
  considered: number
  sent: number
  failed: number
}

const mailFor = async (
  payload: Payload,
  user: User,
  prefs: SpaceEmailPrefs,
  content: DigestContent,
  metas: MetaCache,
) => {
  const lang = prefs.locale
  const spaceIds = [
    ...new Set([...content.mentions, ...content.replies, ...content.posts].map((e) => e.space)),
  ]
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { id: { in: spaceIds } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const spaces = new Map(docs.map((s) => [s.id, s as unknown as SpaceRef]))
  const items = async (entries: Entry[]): Promise<MailItem[]> =>
    Promise.all(
      entries.flatMap((e) => {
        const space = spaces.get(e.space)
        return space
          ? [
              (async () => {
                const meta = await spaceMeta(payload, metas, space, lang)
                return { space: meta.name, text: e.text, url: postUrl(meta, space, e.postId, lang) }
              })(),
            ]
          : []
      }),
    )
  const unsubscribe = unsubscribeUrl(user.id, lang)
  const mail = await digestMail(await getEmailSettings(payload), {
    lang,
    mentions: await items(content.mentions),
    replies: await items(content.replies),
    posts: await items(content.posts),
    more: content.more,
    spacesUrl: spacesUrl(lang),
    settingsUrl: settingsUrl(lang),
    unsubscribe,
  })
  return { mail, unsubscribe }
}

/**
 * The digest run (spec §8). Called every hour; it acts only in the Cairo
 * digest hour, with the daily digests and, on Sunday, the weekly ones too. It
 * sends nothing while the Spaces switch is off. A member gets one mail only
 * when there is something to say, and a failure for one member never stops the
 * others. `pause` is the gap between mails, for Resend's rate limit.
 */
export const runDigests = async (
  payload: Payload,
  now: Date = new Date(),
  { pause = PAUSE_MS }: { pause?: number } = {},
): Promise<DigestRun> => {
  const run: DigestRun = { considered: 0, sent: 0, failed: 0 }
  const due = digestsDueAt(now)
  if (!due.length) return { ...run, skipped: 'hour' }
  if (mode(await spacesSettings(payload)) === 'off') return { ...run, skipped: 'off' }

  const metas: MetaCache = new Map()
  for (let page = 1; ; page++) {
    const batch = await payload.find({
      collection: 'users',
      where: { person: { exists: true } },
      sort: 'id',
      page,
      limit: 100,
      depth: 0,
      overrideAccess: true,
    })
    const prefs = await loadPrefs(
      payload,
      batch.docs.map((u) => u.id),
    )
    for (const user of batch.docs) {
      const p = prefs.get(user.id) ?? prefsOf()
      // Admins read every space without belonging to one: they get no digest.
      if (isAdminUser(user) || !user.email) continue
      if (p.stopped || p.digest === 'off' || !due.includes(p.digest as DigestFrequency)) continue
      run.considered++
      if (p.sentAt && p.sentAt >= hourStart(now)) continue
      try {
        const floor = new Date(now.getTime() - PERIOD_MS[p.digest as DigestFrequency] - SLACK_MS)
        const since = p.sentAt && p.sentAt > floor ? p.sentAt : floor
        const content = await digestContent(payload, user, since, now)
        if (digestSize(content) === 0) continue
        if (!(await claimDigest(payload, user.id, now))) continue
        try {
          const { mail, unsubscribe } = await mailFor(payload, user, p, content, metas)
          await sendSpaceMail(payload, user.email, mail, unsubscribe)
          run.sent++
        } catch (error) {
          await releaseDigest(payload, user.id, now, p.sentAt).catch(() => {})
          throw error
        }
        await wait(pause)
      } catch (error) {
        run.failed++
        payload.logger.error({
          msg: 'A space digest was not sent',
          status: (error as { status?: number }).status,
        })
      }
    }
    if (!batch.hasNextPage) break
  }
  return run
}
