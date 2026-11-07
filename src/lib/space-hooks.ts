import type { Payload } from 'payload'
import type { CollectionAfterChangeHook, PayloadRequest } from 'payload'

import { introBody, type IntroText } from '@/lib/space-intro'
import type { Course, Programme } from '@/payload-types'

/**
 * The space row and its pinned intro post, created once, by hook (spec §1, §11).
 * Idempotent: it counts first, so a re-publish or an admin's edit of a
 * published course never makes a second space. The community space is the
 * seed's to create (seed/collections/spaces.seed.ts).
 */
export const ensureSpaceFor =
  (kind: 'course' | 'cohort'): CollectionAfterChangeHook<Course | Programme> =>
  async ({ doc, req, previousDoc }) => {
    if (doc._status !== 'published') return
    if (previousDoc?._status === 'published') return
    // Only Bridge cohort spaces for now (spec: not Women's Studies or
    // Residency yet; the rule allows them later).
    if (kind === 'cohort' && (doc as Programme).kind !== 'bridge') return
    const relation = kind === 'course' ? 'course' : 'programme'
    const { totalDocs } = await req.payload.count({
      collection: 'spaces',
      where: { [relation]: { equals: doc.id } },
      overrideAccess: true,
    })
    if (totalDocs === 0)
      await req.payload.create({
        collection: 'spaces',
        data: { kind, [relation]: doc.id } as never,
        overrideAccess: true,
        req,
      })
  }

/**
 * Copies the introduction template (both languages, as it reads now) into a
 * pinned post of the space and names it the space's intro post. Later edits
 * of the template reach only spaces made after them. Also the one call a
 * backfill of older spaces needs.
 */
export const addIntroPost = async (payload: Payload, spaceId: number, req?: PayloadRequest) => {
  // Without `req`: the local API sets the request's locale, and the two reads would share it.
  const template = (locale: 'en' | 'ar') =>
    payload.findGlobal({
      slug: 'space-introduction',
      locale,
      fallbackLocale: false,
      overrideAccess: true,
    }) as Promise<IntroText>
  const [en, ar] = await Promise.all([template('en'), template('ar')])
  const post = await payload.create({
    collection: 'space-posts',
    data: {
      space: spaceId,
      author: null,
      kind: 'discussion',
      body: introBody(en, ar),
      pinned: true,
      last_activity_at: new Date().toISOString(),
    } as never,
    overrideAccess: true,
    req,
  })
  await payload.update({
    collection: 'spaces',
    id: spaceId,
    data: { introduction_post: post.id } as never,
    overrideAccess: true,
    req,
  })
  return post.id
}
