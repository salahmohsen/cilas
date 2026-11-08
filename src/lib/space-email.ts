import type { Payload } from 'payload'

import { personOf } from '@/access'
import { getEmailSettings } from '@/emails/settings'
import { announcementMail, type Lang } from '@/emails/space-mail'
import { loadPrefs } from '@/lib/space-email-prefs'
import { env } from '@/env'
import { paced } from '@/lib/resend-contacts'
import { relId } from '@/lib/relation'
import { spacePeople } from '@/lib/space-members'
import { parentRef, spaceHref, spaceTitle, type SpaceRef } from '@/lib/space-ref'
import { spaceOpenOn, mode, spacesSettings, type SpaceLike } from '@/lib/spaces'
import { unsubscribeUrl } from '@/lib/space-email-token'
import type { User } from '@/payload-types'

const origin = () => env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')

/** Strips the Markdown a post is written in down to the words, clipped for a mail line. */
export const clip = (body: string, max = 140): string => {
  const flat = body
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_~`>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat
}

export type MailParts = { subject: string; html: string; text: string }

/**
 * One space email through `payload.sendEmail` (the Resend adapter), with the
 * one-click unsubscribe headers (RFC 8058). Mail clients and scanners that
 * follow the link only open the confirmation page; the POST stops the email.
 */
export const sendSpaceMail = async (
  payload: Payload,
  to: string,
  mail: MailParts,
  unsubscribe: string,
) => {
  await payload.sendEmail({
    to,
    ...mail,
    headers: {
      'List-Unsubscribe': `<${unsubscribe}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}

/** A space's name and address parts per language, read once per run. */
export type SpaceMeta = { name: string; parent: { slug: string | null } | null }
export type MetaCache = Map<string, Promise<SpaceMeta>>

export const spaceMeta = (
  payload: Payload,
  cache: MetaCache,
  space: SpaceRef,
  lang: Lang,
): Promise<SpaceMeta> => {
  const key = `${space.id}:${lang}`
  let hit = cache.get(key)
  if (!hit) {
    hit = (async () => {
      const ref = parentRef(space)
      const parent = ref
        ? ((await payload
            .findByID({
              ...ref,
              depth: 0,
              locale: lang,
              overrideAccess: true,
              draft: true,
              select: { title: true, slug: true },
            } as never)
            .catch(() => null)) as { title?: string | null; slug?: string | null } | null)
        : null
      return {
        name: spaceTitle(space, parent, lang),
        parent: parent ? { slug: parent.slug ?? null } : null,
      }
    })()
    cache.set(key, hit)
  }
  return hit
}

export const postUrl = (meta: SpaceMeta, space: SpaceRef, postId: number, lang: Lang): string =>
  `${origin()}${spaceHref(space, meta.parent, { locale: lang, postId })}`

export const settingsUrl = (lang: Lang) => `${origin()}/${lang}/settings#notifications`
export const spacesUrl = (lang: Lang) => `${origin()}/${lang}/spaces`

type AnnouncementCounts = { sent: number; failed: number; skipped: number }

/**
 * Emails an announcement to every member of its space, once (spec §8). The
 * claim is one conditional UPDATE, so a repeat call, a second tab or two app
 * instances cannot mail it twice. Each recipient is checked against the post's
 * own read rule, which holds the Spaces switch, the member's place in the
 * space and the introduction gate; a member who stopped all space email gets
 * nothing. One failed address does not stop the rest.
 */
export const sendAnnouncementEmails = async (
  payload: Payload,
  postId: number,
): Promise<AnnouncementCounts & { claimed: boolean }> => {
  const none = { sent: 0, failed: 0, skipped: 0, claimed: false }
  const post = (await payload
    .findByID({ collection: 'space-posts', id: postId, depth: 0, overrideAccess: true })
    .catch(() => null)) as {
    id: number
    kind: string
    body: string
    author?: number | { id: number } | null
    space: number | { id: number }
    deleted_at?: string | null
  } | null
  if (!post || post.kind !== 'announcement' || post.deleted_at) return none

  const settings = await spacesSettings(payload)
  const space = (await payload.findByID({
    collection: 'spaces',
    id: relId(post.space) as number,
    depth: 0,
    overrideAccess: true,
  })) as SpaceLike & SpaceRef
  if (mode(settings) === 'off' || !spaceOpenOn(space, settings)) return none

  const claim = await payload.db.pool.query(
    `UPDATE space_posts SET announcement_email_sent = true
     WHERE id = $1 AND announcement_email_sent IS NOT TRUE AND deleted_at IS NULL RETURNING id`,
    [postId],
  )
  if (claim.rowCount !== 1) return none

  const people = await spacePeople(payload, space.id)
  const accounts = people.flatMap((p) => (p.accountId == null ? [] : [p.accountId]))
  const authorPerson = relId(post.author)
  const { docs: users } = accounts.length
    ? await payload.find({
        collection: 'users',
        where: { id: { in: accounts } },
        depth: 0,
        pagination: false,
        overrideAccess: true,
      })
    : { docs: [] as User[] }
  const prefs = await loadPrefs(
    payload,
    users.map((u) => u.id),
  )
  const metas: MetaCache = new Map()
  const counts: AnnouncementCounts = { sent: 0, failed: 0, skipped: 0 }
  const recipients = users.filter((u) => {
    const stopped = prefs.get(u.id)?.stopped
    const author = authorPerson != null && personOf(u) === authorPerson
    if (stopped || author || !u.email) counts.skipped++
    return !stopped && !author && Boolean(u.email)
  })
  const emailSettings = await getEmailSettings(payload)
  const text = clip(post.body, 600)

  counts.failed += await paced(recipients, async (user) => {
    try {
      const readable = await payload
        .findByID({
          collection: 'space-posts',
          id: postId,
          depth: 0,
          user,
          overrideAccess: false,
          select: { kind: true },
        })
        .catch(() => null)
      if (!readable) {
        counts.skipped++
        return true
      }
      const lang = prefs.get(user.id)?.locale ?? 'en'
      const meta = await spaceMeta(payload, metas, space, lang)
      const mail = await announcementMail(emailSettings, {
        lang,
        space: meta.name,
        text,
        url: postUrl(meta, space, postId, lang),
        settingsUrl: settingsUrl(lang),
        unsubscribe: unsubscribeUrl(user.id, lang),
      })
      await sendSpaceMail(payload, user.email, mail, unsubscribeUrl(user.id, lang))
      counts.sent++
      return true
    } catch {
      return false
    }
  })
  return { ...counts, claimed: true }
}
