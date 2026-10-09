import type { Payload } from 'payload'

export const getPublicPosts = async (payload: Payload) => {
  const courses = await payload.find({
    collection: 'courses',
    where: { tier: { equals: 'public' } },
    depth: 2,
  })

  return courses
}
