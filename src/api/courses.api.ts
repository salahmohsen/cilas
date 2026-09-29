import type { Payload } from 'payload'

export const getPublicPosts = async (payload: Payload) => {
  const courses = await payload.find({
    collection: 'courses',
    where: { status: { equals: 'public' } },
  })

  return courses
}
