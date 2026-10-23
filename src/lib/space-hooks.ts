import type { Payload } from 'payload'
import type { CollectionAfterChangeHook } from 'payload'

import type { Course, Programme } from '@/payload-types'

/** Exported so the seed (Task 16) reuses the same literal — two copies of the intro text never drift. */
export const INTRO = 'What question brings you here?\nما السؤال الذي جاء بك إلى هنا؟'

/**
 * The space row and its intro post, created once, by hook (spec §1, §11).
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
  const post = await payload.create({
    collection: 'space-posts',
    data: { space: space.id, author: null, kind: 'discussion', body: INTRO } as never,
    overrideAccess: true,
    req,
  })
  await payload.update({
    collection: 'spaces',
    id: space.id,
    data: { introduction_post: post.id } as never,
    overrideAccess: true,
    req,
  })
  return space
}
