import type { Browser, BrowserContext, Page } from '@playwright/test'
import type { Payload } from 'payload'

import ar from '../messages/ar.json'
import en from '../messages/en.json'
import { parentOf, spaceTitle } from '../src/lib/space-ref'
import { consentAccept } from '../src/lib/spaces-write'
import type { User } from '../src/payload-types'
import { type createTracker, lockSpacesMode, uniq, uniqEmail } from './payload.fixture'

export const MESSAGES = { en, ar }

export const ROLES = ['admin', 'fellow', 'student'] as const
export type PortalRole = (typeof ROLES)[number]

export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const WIDTHS = {
  desktop: { width: 1440, height: 900 },
  phone: { width: 390, height: 844 },
} as const

/** An English path (`/en/...`) in another language. */
export const localePath = (path: string, locale: Locale) =>
  path.replace(/^\/en(?=\/|$)/, `/${locale}`)

export type StorageState = Awaited<ReturnType<BrowserContext['storageState']>>

/** One browser context at `viewport`, signed in when `state` is given; always closed. */
export const inContext = async (
  browser: Browser,
  options: {
    baseURL: string | undefined
    viewport: { width: number; height: number }
    state?: StorageState
  },
  run: (page: Page) => Promise<void>,
) => {
  const context = await browser.newContext({
    baseURL: options.baseURL,
    viewport: options.viewport,
    storageState: options.state,
  })
  try {
    await run(await context.newPage())
  } finally {
    await context.close()
  }
}

export type PortalAccount = { id: number; email: string; password: string; person: number | null }

/** English paths; `label` is `spaceTitle`'s answer in each language: the name the app gives the space. */
export type RoomFixture = {
  space: number
  path: string
  postPath: string
  post: number
  label: Record<Locale, string>
}

export type PortalWorld = {
  accounts: Record<PortalRole, PortalAccount>
  poster: PortalAccount
  course: RoomFixture
  community: RoomFixture
}

type Track = ReturnType<typeof createTracker>['track']

export const PASSWORD = 'e2e-portal-world'

export const ACCOUNT_ROLES = {
  admin: ['admin'],
  fellow: ['fellow'],
  student: ['member'],
  poster: ['member'],
} as const satisfies Record<PortalRole | 'poster', User['roles']>

const personId = (user: User) =>
  user.person == null ? null : typeof user.person === 'object' ? user.person.id : user.person

const account = async (payload: Payload, track: Track, key: keyof typeof ACCOUNT_ROLES) => {
  const email = uniqEmail(`portal-${key}`)
  const user = track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email, password: PASSWORD, roles: [...ACCOUNT_ROLES[key]] },
      depth: 0,
      overrideAccess: true,
    }),
  )
  const consent = await consentAccept({ payload, user })
  if (!consent.ok) throw new Error(`consent refused for ${email}`)
  return { id: user.id, email, password: PASSWORD, person: personId(user) }
}

/**
 * The one place that finds a course's space. It opens with an intro post that
 * gates members and counts as unread (`Spaces.ts` afterChange); this clears and
 * deletes it, so the room starts empty and open.
 */
export const courseRoom = async (payload: Payload, track: Track, course: number) => {
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { course: { equals: course } },
    depth: 0,
    overrideAccess: true,
  })
  if (docs.length !== 1) throw new Error(`course ${course} has ${docs.length} spaces`)
  const space = track('spaces', docs[0]!.id)
  const intro = docs[0]!.introduction_post
  await payload.update({
    collection: 'spaces',
    id: space,
    data: { introduction_post: null },
    overrideAccess: true,
  })
  if (intro != null)
    await payload.delete({
      collection: 'space-posts',
      id: typeof intro === 'object' ? intro.id : intro,
      overrideAccess: true,
    })
  return space
}

const roomLabel = async (payload: Payload, space: number) => {
  const label = {} as Record<Locale, string>
  for (const locale of LOCALES) {
    const doc = await payload.findByID({
      collection: 'spaces',
      id: space,
      locale,
      depth: 0,
      overrideAccess: true,
    })
    label[locale] = spaceTitle(
      doc,
      await parentOf(payload, doc, { select: { title: true }, locale }),
      locale,
    )
  }
  return label
}

/** The body of every post the poster writes. */
export const POST_BODY = 'E2E portal post.'

const postIn = async (payload: Payload, track: Track, space: number, author: number) =>
  track(
    'space-posts',
    await payload.create({
      collection: 'space-posts',
      data: { space, kind: 'discussion', author, body: POST_BODY },
      depth: 0,
      overrideAccess: true,
    }),
  ).id

/**
 * Admin, fellow, student and a poster; a published course in 2034 (the fellow
 * teaches it, student and poster are enrolled) and its space; a community
 * space for all members. The poster writes one post in each room, so every
 * role has exactly one unread post per room.
 */
export const portalWorld = async (payload: Payload, track: Track) => {
  const [admin, fellow, student, poster] = [
    await account(payload, track, 'admin'),
    await account(payload, track, 'fellow'),
    await account(payload, track, 'student'),
    await account(payload, track, 'poster'),
  ]
  const place = track(
    'places',
    await payload.create({
      collection: 'places',
      data: { name: 'Portal e2e place', slug: uniq('portal-e2e-place'), city: uniq('E2E') },
      overrideAccess: true,
    }),
  ).id
  const cycle = track(
    'cycles',
    await payload.create({
      collection: 'cycles',
      data: { season: 'fall', start_year: 2034, place, start_date: '2034-10-04' },
      overrideAccess: true,
    }),
  ).id
  const slug = uniq('portal-e2e-course')
  const title = { en: uniq('Portal course'), ar: uniq('مساق البوابة') }
  const course = track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: title.en,
        slug,
        course_type: 'THEMATIC',
        tier: 'public',
        cycle,
        fellows: [fellow.person!],
        registration: { mode: 'closed' },
        _status: 'published',
      },
      locale: 'en',
      overrideAccess: true,
    }),
  ).id
  await payload.update({
    collection: 'courses',
    id: course,
    data: { title: title.ar },
    locale: 'ar',
    overrideAccess: true,
  })
  track(
    'sessions',
    await payload.create({
      collection: 'sessions',
      data: {
        course,
        title: 'Portal e2e session',
        meetings: [{ date: '2034-10-05', start_time: '19:00', end_time: '21:00' }],
      },
      overrideAccess: true,
    }),
  )
  for (const member of [student, poster])
    track(
      'enrollments',
      await payload.create({
        collection: 'enrollments',
        data: { person: member.person!, course, status: 'accepted', source: 'admin' },
        overrideAccess: true,
      }),
    )
  const courseSpace = await courseRoom(payload, track, course)
  const name = { en: uniq('Portal community'), ar: uniq('مجتمع البوابة') }
  const communitySpace = track(
    'spaces',
    await payload.create({
      collection: 'spaces',
      data: { kind: 'community', name: name.en, audience: 'all' },
      locale: 'en',
      overrideAccess: true,
    }),
  ).id
  await payload.update({
    collection: 'spaces',
    id: communitySpace,
    data: { name: name.ar },
    locale: 'ar',
    overrideAccess: true,
  })
  const coursePost = await postIn(payload, track, courseSpace, poster.person!)
  const communityPost = await postIn(payload, track, communitySpace, poster.person!)
  const coursePath = `/en/spaces/course/${slug}`
  const communityPath = `/en/spaces/community/${communitySpace}`
  return {
    accounts: { admin, fellow, student },
    poster,
    course: {
      space: courseSpace,
      path: coursePath,
      postPath: `${coursePath}/posts/${coursePost}`,
      post: coursePost,
      label: await roomLabel(payload, courseSpace),
    },
    community: {
      space: communitySpace,
      path: communityPath,
      postPath: `${communityPath}/posts/${communityPost}`,
      post: communityPost,
      label: await roomLabel(payload, communitySpace),
    },
  } satisfies PortalWorld
}

/**
 * Takes the spaces-mode lock and remembers the two settings; `release`
 * restores them and frees the lock. Once per file: a second call waits forever.
 */
export const holdSpacesMode = async (payload: Payload) => {
  const unlock = await lockSpacesMode()
  const before = await payload.findGlobal({ slug: 'site-settings', overrideAccess: true })
  const write = (data: { spaces_mode: 'off' | 'trial' | 'on'; spaces_trial_community: boolean }) =>
    payload.updateGlobal({ slug: 'site-settings', data, overrideAccess: true })
  return {
    set: async (mode: 'off' | 'trial' | 'on', options?: { trialCommunity: boolean }) => {
      await write({
        spaces_mode: mode,
        spaces_trial_community: options?.trialCommunity ?? before.spaces_trial_community ?? false,
      })
    },
    release: async () => {
      try {
        await write({
          spaces_mode: before.spaces_mode ?? 'off',
          spaces_trial_community: before.spaces_trial_community ?? false,
        })
      } finally {
        await unlock()
      }
    },
  }
}

/** A bell row for `account` that links to `link`; the tracker deletes it with its recipient. */
export const notifyOf = async (payload: Payload, account: PortalAccount, link: string) => {
  await payload.create({
    collection: 'notifications',
    data: { recipient: account.id, kind: 'comment', title: 'E2E comment', link },
    overrideAccess: true,
  })
}
