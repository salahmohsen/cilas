import { CAIRO } from '@/lib/cairo-day'
import { type Locale } from '@/i18n/routing'
import { otherLocale } from '@/i18n/routing'
import type { Payload } from 'payload'

import type {
  NewsletterIssue,
  NewsletterPublication,
  NewsletterStory,
} from '@/components/arc/blocks/newsletter-signup/newsletter-signup-data'
import { pickItemOf } from '@/emails/pick-types'
import { readingMinutes } from '@/lib/articles'
import { newsletterList } from '@/lib/newsletter-list'
import { focalPointStyle } from '@/lib/media-image'
import type { Article, Media, Newsletter } from '@/payload-types'

const thumbOf = (media: unknown): string | null => {
  const m = media as Media | null
  if (!m || typeof m !== 'object') return null
  return m.url ?? null
}

const storyOf = (relationTo: string, doc: unknown): NewsletterStory | null => {
  const d = doc as {
    title?: string
    cover_image?: unknown
    cover?: unknown
    body?: Article['body']
  } | null
  if (!d || typeof d !== 'object' || !d.title) return null
  return {
    title: d.title,
    image: thumbOf(d.cover_image ?? d.cover),
    imageStyle: focalPointStyle((d.cover_image ?? d.cover) as Media | null),
    minutes: relationTo === 'articles' ? readingMinutes(d as Pick<Article, 'body'>) : null,
  }
}

/** An issue's picks, in order, as the stories on its card. */
const storiesOf = (issue: Newsletter): NewsletterStory[] =>
  (issue.sections ?? []).flatMap((section) =>
    section.blockType === 'picks'
      ? (section.items ?? []).flatMap((pick) => {
          const item = pickItemOf(pick as Record<string, unknown>)
          const story = item ? storyOf(item.relationTo, item.value) : null
          return story ? [story] : []
        })
      : [],
  )

/**
 * The stack the newsletter signup shows: the last published issues, newest
 * first, and the next one, which holds the newest articles. Null when signup
 * is not set up (no list in Email settings): then there is no form to show.
 * `publication` is null when no issue is out yet: the form shows alone.
 */
export const getNewsletterStack = async (
  payload: Payload,
  locale: Locale,
  labels: { name: string; next: string; nextSubject: string },
): Promise<{ publication: NewsletterPublication | null } | null> => {
  if (!(await newsletterList(payload))) return null
  const read = {
    locale,
    fallbackLocale: otherLocale(locale) as Locale,
    overrideAccess: false,
  }
  const [issues, latest] = await Promise.all([
    payload.find({
      collection: 'newsletters',
      where: { _status: { equals: 'published' } },
      sort: '-issue_date',
      depth: 2,
      limit: 3,
      ...read,
    }),
    payload.find({
      collection: 'articles',
      where: { and: [{ _status: { equals: 'published' } }, { tier: { equals: 'public' } }] },
      sort: '-published_date',
      depth: 1,
      limit: 3,
      select: { title: true, cover_image: true, body: true },
      ...read,
    }),
  ])
  if (!issues.docs.length) return { publication: null }

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: CAIRO,
    })
  // Numbered by their order among the published issues: the newest is the count.
  const recent: NewsletterIssue[] = issues.docs.map((issue, i) => ({
    number: issues.totalDocs - i,
    date: day(issue.issue_date),
    subject: issue.title,
    stories: storiesOf(issue),
  }))
  const upcoming: NewsletterIssue = {
    number: issues.totalDocs + 1,
    date: labels.next,
    subject: labels.nextSubject,
    stories: latest.docs.flatMap((a) => {
      const story = storyOf('articles', a)
      return story ? [story] : []
    }),
  }
  return { publication: { name: labels.name, upcoming, recent } }
}
