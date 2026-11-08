// @vitest-environment node
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { GET, POST } from '@/app/(frontend)/api/space-email/unsubscribe/route'
import { personOf } from '@/access'
import config from '@/payload.config'
import type { Space, User } from '@/payload-types'
import { runDigests } from '@/lib/space-digest'
import { sendAnnouncementEmails } from '@/lib/space-email'
import { prefsOf, setSpaceEmail } from '@/lib/space-email-prefs'
import { unsubscribeUrl, verifyUnsubscribeToken } from '@/lib/space-email-token'

import { RUN, createTracker, lockSpacesMode, uniq, uniqEmail } from './fixtures'

type Mail = {
  to: string
  subject: string
  html: string
  text: string
  headers?: Record<string, string>
}

// Winter: Cairo is UTC+2, so Sunday 14:05Z is Sunday 16:05 in Cairo.
const SUNDAY = new Date('2026-11-08T14:05:00Z')
const MONDAY = new Date('2026-11-09T14:05:00Z')
const at = (offsetHours: number) => new Date(SUNDAY.getTime() + offsetHours * 3_600_000)

let payload: Payload
let unlock: () => Promise<void>
let modeBefore: 'off' | 'trial' | 'on' = 'off'
let sent: Mail[]
let failFor: string | null = null

const { track, cleanup } = createTracker()

const users: Record<string, User> = {}
const people: Record<string, number> = {}
let course: { id: number }
let space: Space
let intro: number

const mailsTo = (user: User) => sent.filter((m) => m.to === user.email)

const mkUser = async (key: string, roles: ('member' | 'admin')[] = ['member']) => {
  const p = await payload.create({
    collection: 'people',
    data: { name: `Mail ${key}`, slug: uniq(`mail-${key}`) },
    overrideAccess: true,
  })
  track('people', p.id)
  const u = await payload.create({
    collection: 'users',
    data: { email: uniqEmail(`mail-${key}`), password: 'probe-probe', roles, person: p.id },
    overrideAccess: true,
  })
  track('users', u.id)
  users[key] = u as unknown as User
  people[key] = p.id
}

const stamp = (table: 'space_posts' | 'space_comments', id: number, when: Date) =>
  payload.db.pool.query(`UPDATE ${table} SET created_at = $1 WHERE id = $2`, [
    when.toISOString(),
    id,
  ])

const post = async (key: string, body: string, when: Date, extra: Record<string, unknown> = {}) => {
  const row = await payload.create({
    collection: 'space-posts',
    data: { space: space.id, author: people[key], kind: 'discussion', body, ...extra } as never,
    overrideAccess: true,
  })
  track('space-posts', row.id)
  await stamp('space_posts', row.id, when)
  return row.id
}

const comment = async (key: string, on: number, body: string, when: Date) => {
  const row = await payload.create({
    collection: 'space-comments',
    data: { space: space.id, post: on, author: people[key], body } as never,
    overrideAccess: true,
  })
  track('space-comments', row.id)
  await stamp('space_comments', row.id, when)
  return row.id
}

const clearClaims = () =>
  payload.db.pool.query(`UPDATE space_preferences SET digest_sent_at = NULL`)

const setMode = (mode: 'off' | 'trial' | 'on') =>
  payload.updateGlobal({
    slug: 'site-settings',
    data: {
      spaces_mode: mode,
      spaces_trial_courses: mode === 'trial' ? [course.id] : [],
      spaces_trial_community: false,
    },
    overrideAccess: true,
  })

describe('space email', () => {
  beforeAll(async () => {
    unlock = await lockSpacesMode()
    payload = await getPayload({ config: await (config as never as Promise<typeof config>) })
    modeBefore =
      (
        (await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })) as {
          spaces_mode?: 'off' | 'trial' | 'on'
        }
      ).spaces_mode ?? 'off'

    for (const key of ['fellow', 'a', 'b', 'c', 'd', 'e', 'f']) await mkUser(key)
    await mkUser('admin', ['admin', 'member'])

    const place = await payload.create({
      collection: 'places',
      data: { name: 'Mail Place', slug: uniq('mail-place'), city: `Mailville ${RUN}` },
      overrideAccess: true,
    })
    track('places', place.id)
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2032, place: place.id, start_date: '2032-03-04' },
      overrideAccess: true,
    })
    track('cycles', cycle.id)
    course = (await payload.create({
      collection: 'courses',
      data: {
        title: 'Mail Course',
        slug: uniq('mail-course'),
        course_type: 'THEMATIC',
        session_unit: 'session',
        tier: 'owner',
        cycle: cycle.id,
        fellows: [people.fellow],
        _status: 'published',
      },
      overrideAccess: true,
    })) as unknown as { id: number }
    track('courses', course.id)
    for (const key of ['a', 'b', 'c', 'd', 'e', 'f', 'admin']) {
      const enrolment = await payload.create({
        collection: 'enrollments',
        data: {
          course: course.id,
          person: people[key],
          status: key === 'f' ? 'withdrawn' : 'confirmed',
        } as never,
        overrideAccess: true,
      })
      track('enrollments', enrolment.id as number)
    }
    const { docs } = await payload.find({
      collection: 'spaces',
      where: { course: { equals: course.id } },
      overrideAccess: true,
    })
    space = docs[0] as unknown as Space
    track('spaces', space.id)
    const introRef = (space as unknown as { introduction_post: number | { id: number } })
      .introduction_post
    intro = typeof introRef === 'object' ? introRef.id : introRef
    track('space-posts', intro)

    // Everyone but d has introduced themselves, so the introduction gate is open for them.
    for (const key of ['a', 'b', 'c', 'e']) {
      const row = await payload.create({
        collection: 'space-comments',
        data: { space: space.id, post: intro, author: people[key], body: 'hi' } as never,
        overrideAccess: true,
      })
      track('space-comments', row.id)
      await stamp('space_comments', row.id, at(-24 * 40))
    }

    // Choices: a has none (weekly), b daily, c stopped, d off, e Arabic.
    await setSpaceEmail(payload, users.b!.id, { digest: 'daily' })
    await setSpaceEmail(payload, users.c!.id, { stopped: true, digest: 'weekly' })
    await setSpaceEmail(payload, users.d!.id, { digest: 'off' })
    await setSpaceEmail(payload, users.e!.id, { digest: 'weekly', locale: 'ar' })
    await setMode('trial')

    // The story, in time before SUNDAY.
    await post('fellow', 'Old news from the fellow', at(-24 * 10))
    const own = await post('a', 'Own post by A', at(-23))
    await post('fellow', 'Fellow plain news', at(-20))
    await post('fellow', `Hello [@Mail a](/people/${people.a}) look here`, at(-19))
    await comment('b', own, 'B replies to A', at(-10))
    const deleted = await post('fellow', 'Deleted post text', at(-5))
    await payload.update({
      collection: 'space-posts',
      id: deleted,
      data: { deleted_at: at(-4).toISOString() } as never,
      overrideAccess: true,
    })
    await post('fellow', 'Announced already', at(-6), {
      kind: 'announcement',
      announcement_email_sent: true,
    })
  }, 600_000)

  afterAll(async () => {
    const ids = Object.values(users).map((u) => u.id)
    await payload.db.pool.query(`DELETE FROM space_preferences WHERE account_id = ANY($1)`, [ids])
    await setMode(modeBefore)
    await cleanup(payload)
    await payload.destroy()
    await unlock()
  })

  beforeEach(() => {
    sent = []
    failFor = null
    vi.spyOn(payload, 'sendEmail').mockImplementation((async (m: Mail) => {
      if (failFor && m.to === failFor) throw Object.assign(new Error('boom'), { status: 422 })
      sent.push(m)
      return {}
    }) as never)
  })

  describe('digest', () => {
    it('sends nothing outside the Cairo digest hour', async () => {
      const early = await runDigests(payload, new Date('2026-11-08T13:55:00Z'), { pause: 0 })
      const late = await runDigests(payload, new Date('2026-11-08T15:05:00Z'), { pause: 0 })
      expect(early.skipped).toBe('hour')
      expect(late.skipped).toBe('hour')
      expect(sent).toHaveLength(0)
    })

    it('sends nothing at all when there is nothing new, and records nothing', async () => {
      const quiet = new Date(SUNDAY.getTime() + 21 * 24 * 3_600_000)
      const run = await runDigests(payload, quiet, { pause: 0 })
      expect(run.sent).toBe(0)
      expect(sent).toHaveLength(0)
      const { rows } = await payload.db.pool.query(
        `SELECT 1 FROM space_preferences WHERE digest_sent_at IS NOT NULL AND account_id = ANY($1)`,
        [Object.values(users).map((u) => u.id)],
      )
      expect(rows).toHaveLength(0)
    })

    it('lists mentions, replies and new posts, without own, deleted or already-mailed content', async () => {
      const run = await runDigests(payload, SUNDAY, { pause: 0 })
      expect(run.failed).toBe(0)
      const mail = mailsTo(users.a!)
      expect(mail).toHaveLength(1)
      const html = mail[0]!.html
      expect(html).toContain('Fellow plain news')
      expect(html).toContain('look here') // the post that mentions A
      expect(html).toContain('B replies to A')
      expect(html).not.toContain('Own post by A')
      expect(html).not.toContain('Deleted post text')
      expect(html).not.toContain('Announced already')
      expect(html).not.toContain('Old news from the fellow')
      // Sections, in order: mentions, replies, new posts.
      expect(html.indexOf('Mentions of you')).toBeLessThan(html.indexOf('Replies to you'))
      expect(html.indexOf('Replies to you')).toBeLessThan(html.indexOf('New posts'))
      // The mention is not repeated among the new posts.
      expect(html.match(/look here/g)).toHaveLength(1)
      expect(mail[0]!.text).toContain('Fellow plain news')
    })

    it('sends the one-click unsubscribe headers with a token for the account', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      const mail = mailsTo(users.a!)[0]!
      const match = /^<(.+)>$/.exec(mail.headers!['List-Unsubscribe']!)
      expect(match).not.toBeNull()
      const url = new URL(match![1]!)
      expect(verifyUnsubscribeToken(url.searchParams.get('t'))).toBe(users.a!.id)
      expect(mail.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click')
      expect(mail.html).toContain(match![1]!.replace(/&/g, '&amp;'))
    })

    it('gives the daily member only the last day and never the member’s own comments', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      const html = mailsTo(users.b!)[0]!.html
      expect(html).toContain('Own post by A') // another member's post: new to B
      expect(html).not.toContain('B replies to A') // B wrote it
      expect(html).not.toContain('Old news from the fellow')
    })

    it('follows the saved language', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      const mail = mailsTo(users.e!)[0]!
      expect(mail.html).toContain('dir="rtl"')
      expect(mail.html).toContain('lang="ar"')
      expect(mail.html).toContain('ما جرى في مساحاتك')
      expect(mailsTo(users.a!)[0]!.html).toContain('lang="en"')
    })

    it('skips members who stopped email, chose no digest, lost the place, and admins', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      for (const key of ['c', 'd', 'f', 'admin']) expect(mailsTo(users[key]!)).toHaveLength(0)
      // A withdrawn member would still have been mailed had the access rule not stopped it.
      const { rows } = await payload.db.pool.query(
        `SELECT 1 FROM space_preferences WHERE account_id = $1`,
        [users.f!.id],
      )
      expect(rows).toHaveLength(0)
    })

    it('does not send twice for a repeat, and not when two runs overlap', async () => {
      await clearClaims()
      await Promise.all([
        runDigests(payload, SUNDAY, { pause: 0 }),
        runDigests(payload, SUNDAY, { pause: 0 }),
      ])
      await runDigests(payload, new Date(SUNDAY.getTime() + 10 * 60_000), { pause: 0 })
      for (const key of ['a', 'b', 'e']) expect(mailsTo(users[key]!)).toHaveLength(1)
    })

    it('creates the preference row on a first digest and records the claim', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      const { docs } = await payload.find({
        collection: 'space-preferences',
        where: { account: { equals: users.a!.id } },
        overrideAccess: true,
      })
      expect(docs).toHaveLength(1)
      const row = prefsOf(docs[0])
      expect(row.digest).toBe('weekly')
      expect(row.sentAt?.toISOString()).toBe(SUNDAY.toISOString())
    })

    it('looks back from the last digest, so a later run lists only what is new since', async () => {
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      sent = []
      const late = await post('fellow', 'Posted after the digest', at(2))
      await runDigests(payload, MONDAY, { pause: 0 })
      const html = mailsTo(users.b!)[0]!.html // b is daily
      expect(html).toContain('Posted after the digest')
      expect(html).not.toContain('Fellow plain news')
      expect(mailsTo(users.a!)).toHaveLength(0) // weekly: not on Monday
      await payload.delete({ collection: 'space-posts', id: late, overrideAccess: true })
    })

    it('sends the weekly digest on Sunday only', async () => {
      await clearClaims()
      const run = await runDigests(payload, MONDAY, { pause: 0 })
      expect(run.skipped).toBeUndefined()
      expect(mailsTo(users.a!)).toHaveLength(0)
    })

    it('lets one failure pass, and gives the claim back so a retry sends it', async () => {
      await clearClaims()
      failFor = users.a!.email
      const first = await runDigests(payload, SUNDAY, { pause: 0 })
      expect(first.failed).toBe(1)
      expect(mailsTo(users.a!)).toHaveLength(0)
      expect(mailsTo(users.b!)).toHaveLength(1)
      expect(mailsTo(users.e!)).toHaveLength(1)
      failFor = null
      await runDigests(payload, new Date(SUNDAY.getTime() + 5 * 60_000), { pause: 0 })
      expect(mailsTo(users.a!)).toHaveLength(1)
      expect(mailsTo(users.b!)).toHaveLength(1)
    })

    it('stops a member’s digest when their access ends', async () => {
      await clearClaims()
      const { docs } = await payload.find({
        collection: 'enrollments',
        where: { and: [{ course: { equals: course.id } }, { person: { equals: people.e } }] },
        overrideAccess: true,
      })
      await payload.update({
        collection: 'enrollments',
        id: docs[0]!.id,
        data: { status: 'withdrawn' } as never,
        overrideAccess: true,
      })
      await runDigests(payload, SUNDAY, { pause: 0 })
      expect(mailsTo(users.e!)).toHaveLength(0)
      expect(mailsTo(users.a!)).toHaveLength(1)
      await payload.update({
        collection: 'enrollments',
        id: docs[0]!.id,
        data: { status: 'confirmed' } as never,
        overrideAccess: true,
      })
    })

    it('obeys the Spaces switch', async () => {
      await clearClaims()
      await setMode('off')
      expect((await runDigests(payload, SUNDAY, { pause: 0 })).skipped).toBe('off')
      await payload.updateGlobal({
        slug: 'site-settings',
        data: { spaces_mode: 'trial', spaces_trial_courses: [], spaces_trial_community: false },
        overrideAccess: true,
      })
      expect((await runDigests(payload, SUNDAY, { pause: 0 })).sent).toBe(0)
      expect(sent).toHaveLength(0)
      await setMode('trial')
    })

    it('mails a member again once they turn email back on, with their saved frequency', async () => {
      await clearClaims()
      await setSpaceEmail(payload, users.c!.id, { stopped: false })
      await runDigests(payload, SUNDAY, { pause: 0 })
      expect(mailsTo(users.c!)).toHaveLength(1)
      await setSpaceEmail(payload, users.c!.id, { stopped: true })
    })
  })

  describe('announcements', () => {
    const announce = async (body: string) => {
      const id = await post('fellow', body, new Date(), { kind: 'announcement', pinned: true })
      return id
    }

    it('emails each member who can read it, once, and nobody else', async () => {
      const id = await announce('Room change for next week')
      const result = await sendAnnouncementEmails(payload, id)
      expect(result.claimed).toBe(true)
      const to = new Set(sent.map((m) => m.to))
      expect(to).toEqual(
        new Set([users.a!.email, users.b!.email, users.e!.email, users.admin!.email]),
      )
      // c stopped all email, d has not introduced themselves (cannot read it),
      // f withdrew, and the author wrote it.
      for (const key of ['c', 'd', 'f', 'fellow']) expect(mailsTo(users[key]!)).toHaveLength(0)
      expect(sent[0]!.headers!['List-Unsubscribe']).toContain('/api/space-email/unsubscribe?t=')
      expect(mailsTo(users.e!)[0]!.html).toContain('dir="rtl"')
      const row = await payload.findByID({ collection: 'space-posts', id, overrideAccess: true })
      expect((row as { announcement_email_sent?: boolean }).announcement_email_sent).toBe(true)

      sent = []
      const again = await sendAnnouncementEmails(payload, id)
      expect(again.claimed).toBe(false)
      expect(sent).toHaveLength(0)
    })

    it('does not mail twice when two sends overlap', async () => {
      const id = await announce('Library hours')
      await Promise.all([sendAnnouncementEmails(payload, id), sendAnnouncementEmails(payload, id)])
      expect(mailsTo(users.a!)).toHaveLength(1)
    })

    it('mails nothing while the switch is off and leaves the post unclaimed', async () => {
      const id = await announce('Held back')
      await setMode('off')
      const result = await sendAnnouncementEmails(payload, id)
      await setMode('trial')
      expect(result.claimed).toBe(false)
      expect(sent).toHaveLength(0)
      const row = await payload.findByID({ collection: 'space-posts', id, overrideAccess: true })
      expect((row as { announcement_email_sent?: boolean }).announcement_email_sent).toBe(false)
    })

    it('ignores posts that are not announcements', async () => {
      const id = await post('fellow', 'Just a chat', new Date())
      expect((await sendAnnouncementEmails(payload, id)).claimed).toBe(false)
      expect(sent).toHaveLength(0)
    })

    it('lets one failed address pass', async () => {
      const id = await announce('Exhibition opens')
      failFor = users.a!.email
      const result = await sendAnnouncementEmails(payload, id)
      expect(result.failed).toBe(1)
      expect(mailsTo(users.b!)).toHaveLength(1)
    })
  })

  describe('unsubscribe link', () => {
    const urlFor = (key: string, lang: 'en' | 'ar' = 'en') => unsubscribeUrl(users[key]!.id, lang)
    const rowOf = async (key: string) => {
      const { docs } = await payload.find({
        collection: 'space-preferences',
        where: { account: { equals: users[key]!.id } },
        overrideAccess: true,
      })
      return docs[0] ? prefsOf(docs[0]) : null
    }

    it('shows a confirmation on GET and changes nothing', async () => {
      const res = await GET(new Request(urlFor('a')))
      expect(res.status).toBe(200)
      expect(res.headers.get('cache-control')).toBe('no-store')
      const html = await res.text()
      expect(html).toContain('<form method="post"')
      expect((await rowOf('a'))?.stopped ?? false).toBe(false)
    })

    it('stops all space email on POST and keeps the digest choice', async () => {
      const res = await POST(new Request(urlFor('b'), { method: 'POST' }))
      expect(res.status).toBe(200)
      const row = await rowOf('b')
      expect(row?.stopped).toBe(true)
      expect(row?.digest).toBe('daily')
      await clearClaims()
      await runDigests(payload, SUNDAY, { pause: 0 })
      expect(mailsTo(users.b!)).toHaveLength(0)
      await setSpaceEmail(payload, users.b!.id, { stopped: false })
    })

    it('works as the one-click POST mail clients send, with no session', async () => {
      const res = await POST(
        new Request(urlFor('d', 'ar'), {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: 'List-Unsubscribe=One-Click',
        }),
      )
      expect(res.status).toBe(200)
      expect((await res.text()).includes('lang="ar"')).toBe(true)
      expect((await rowOf('d'))?.stopped).toBe(true)
    })

    it('refuses a tampered or foreign token and changes nothing', async () => {
      const url = new URL(urlFor('e'))
      const token = url.searchParams.get('t')!
      const other = new URL(urlFor('a')).searchParams.get('t')!
      const forged = `${users.a!.id}.${token.split('.')[1]}`
      for (const bad of [token.slice(0, -2) + 'xx', forged, `${other}x`, 'nonsense', '']) {
        url.searchParams.set('t', bad)
        expect((await POST(new Request(url, { method: 'POST' }))).status).toBe(400)
        expect((await GET(new Request(url))).status).toBe(400)
      }
      expect((await rowOf('e'))?.stopped).toBe(false)
      expect((await rowOf('a'))?.stopped ?? false).toBe(false)
    })
  })

  it('knows each fixture user’s person', () => {
    expect(personOf(users.a)).toBe(people.a)
  })
})
