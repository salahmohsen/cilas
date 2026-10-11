import type { Payload } from 'payload'

/**
 * Published public courses. Drafts (imported courses awaiting review among
 * them) stay off the list, matching what `/study/<slug>` will show.
 */
export const getPublicPosts = async (payload: Payload, locale: 'en' | 'ar' = 'en') => {
  const courses = await payload.find({
    collection: 'courses',
    where: { and: [{ tier: { equals: 'public' } }, { _status: { equals: 'published' } }] },
    depth: 2,
    overrideAccess: false,
    locale,
    // A course without text in the site language shows its own (CONTEXT.md).
    fallbackLocale: locale === 'ar' ? 'en' : 'ar',
  })

  return courses
}
