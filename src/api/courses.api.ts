import type { Payload } from 'payload'

/**
 * Published public courses. Drafts (imported courses awaiting review among
 * them) stay off the list, matching what `/study/<slug>` will show.
 */
export const getPublicPosts = async (payload: Payload) => {
  const courses = await payload.find({
    collection: 'courses',
    where: { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] },
    depth: 2,
    overrideAccess: false,
  })

  return courses
}
