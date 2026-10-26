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
export const ensureSpaceForCourse: CollectionAfterChangeHook<Course> = async ({
  doc,
  req,
  previousDoc,
}) => {
  if (doc._status !== 'published') return
  if (previousDoc?._status === 'published') return
  const noSpace = await req.payload.count({
    collection: 'spaces',
    where: { course: { equals: doc.id } },
    overrideAccess: true,
  })
  if (noSpace.totalDocs === 0) await createSpace(req.payload, req, 'course', { course: doc.id })
}

export const ensureSpaceForProgramme: CollectionAfterChangeHook<Programme> = async ({
  doc,
  req,
  previousDoc,
}) => {
  if (doc._status !== 'published') return
  if (previousDoc?._status === 'published') return
  // Only Bridge cohort spaces for now (spec: not Women's Studies or
  // Residency yet; the rule allows them later).
  if (doc.kind !== 'bridge') return
  const noSpace = await req.payload.count({
    collection: 'spaces',
    where: { programme: { equals: doc.id } },
    overrideAccess: true,
  })
  if (noSpace.totalDocs === 0) await createSpace(req.payload, req, 'cohort', { programme: doc.id })
}

const createSpace = async (
  payload: Payload,
  req: Parameters<CollectionAfterChangeHook<Course>>[0]['req'],
  kind: 'course' | 'cohort',
  rel: { course?: number; programme?: number },
) => {
  const space = await payload.create({
    collection: 'spaces',
    data: { kind, ...rel } as never,
    overrideAccess: true,
    req,
  })
  await addIntroPost(payload, space.id, req)
  return space
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
