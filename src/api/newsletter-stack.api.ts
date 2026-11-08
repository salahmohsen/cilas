import { type Locale, otherLocale } from '@/i18n/routing'
import { CAIRO } from '@/lib/cairo-day'
import type { Payload } from 'payload'

import type {
  NewsletterIssue,
  NewsletterPublication,
  NewsletterStory,
} from '@/components/arc/blocks/newsletter-signup/newsletter-signup-data'
import { fillPicks, picksIn } from '@/emails/issue'
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

const picksOf = (issue: Newsletter) =>
  picksIn(issue.sections).flatMap((pick) => {
    const item = pickItemOf(pick)
    return item ? [item] : []
  })

type Group = 'cycles' | 'publications'
type GroupStories = Record<Group, Map<number, NewsletterStory[]>>

const isGroup = (relationTo: string): relationTo is Group =>
  relationTo === 'cycles' || relationTo === 'publications'

const idOf = (value: unknown): number | null => {
  const id = typeof value === 'object' ? (value as { id?: unknown } | null)?.id : value
  return typeof id === 'number' ? id : null
}

/** The stories inside every cycle and article collection picked in these issues. */
const groupStories = async (
  payload: Payload,
  issues: Newsletter[],
  read: { locale: Locale; fallbackLocale: Locale; overrideAccess: false },
): Promise<GroupStories> => {
  const ids = (group: Group) => [
    ...new Set(
      issues.flatMap(picksOf).flatMap(({ relationTo, value }) => {
        const id = relationTo === group ? idOf(value) : null
        return id === null ? [] : [id]
      }),
    ),
  ]
  const cycleIds = ids('cycles')
  const publicationIds = ids('publications')
  const [courses, publications] = await Promise.all([
    cycleIds.length
      ? payload.find({
          collection: 'courses',
          where: {
            and: [
              { cycle: { in: cycleIds } },
              { _status: { equals: 'published' } },
              { tier: { equals: 'public' } },
            ],
          },
          sort: 'title',
          depth: 1,
          pagination: false,
          select: { title: true, cover_image: true, cycle: true },
          ...read,
        })
      : null,
    publicationIds.length
      ? payload.find({
          collection: 'publications',
          where: { id: { in: publicationIds } },
          depth: 2,
          pagination: false,
          select: { articles: true },
          ...read,
        })
      : null,
  ])

  const cycles = new Map<number, NewsletterStory[]>()
  for (const course of courses?.docs ?? []) {
    const cycle = idOf(course.cycle)
    const story = storyOf('courses', course)
    if (cycle !== null && story) cycles.set(cycle, [...(cycles.get(cycle) ?? []), story])
  }
  const collections = new Map(
    (publications?.docs ?? []).map((publication) => [
      publication.id,
      (publication.articles ?? []).flatMap((article) => {
        const open =
          typeof article === 'object' &&
          article._status === 'published' &&
          article.tier === 'public'
        const story = open ? storyOf('articles', article) : null
        return story ? [story] : []
      }),
    ]),
  )
  return { cycles, publications: collections }
}

/** An issue's picks, in order, as the stories on its card. A cycle or an article collection shows what it holds. */
const storiesOf = (issue: Newsletter, groups: GroupStories): NewsletterStory[] =>
  picksOf(issue).flatMap(({ relationTo, value }) => {
    const id = isGroup(relationTo) ? idOf(value) : null
    const members = isGroup(relationTo) && id !== null ? groups[relationTo].get(id) : undefined
    if (members?.length) return members
    const story = storyOf(relationTo, value)
    return story ? [story] : []
  })

/**
 * The stack the newsletter signup shows: the newest public issue in full, and
 * only the numbers of what surrounds it. The issues behind it show just a top
 * edge, so nothing else is sent to the browser. An issue is public when it
 * went to the signup list; an empty "Send to" means that list. Null when
 * signup is not set up: then there is no form to show. `publication` is null
 * when no public issue is out yet: the form shows alone.
 */
export const getNewsletterStack = async (
  payload: Payload,
  locale: Locale,
  labels: { name: string; next: string; nextSubject: string },
): Promise<{ publication: NewsletterPublication | null } | null> => {
  const list = await newsletterList(payload)
  if (!list) return null
  const read = {
    locale,
    fallbackLocale: otherLocale(locale) as Locale,
    overrideAccess: false as const,
  }
  const issues = await payload.find({
    collection: 'newsletters',
    where: {
      and: [
        { _status: { equals: 'published' } },
        { or: [{ send_to: { exists: false } }, { send_to: { equals: list.id } }] },
      ],
    },
    sort: '-issue_date',
    depth: 0,
    limit: 1,
    ...read,
  })
  const latest = issues.docs[0]
  if (!latest) return { publication: null }
  await fillPicks(payload, latest.sections, read)
  const groups = await groupStories(payload, [latest], read)

  const day = (iso: string) =>
    new Date(iso).toLocaleDateString(locale === 'ar' ? 'ar-EG' : 'en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: CAIRO,
    })
  // Numbered by their order among the public issues: the newest is the count.
  const newest = issues.totalDocs
  const sheet = (number: number): NewsletterIssue => ({
    number,
    date: '',
    subject: '',
    stories: [],
  })
  const recent: NewsletterIssue[] = [
    {
      number: newest,
      date: day(latest.issue_date),
      subject: latest.title,
      stories: storiesOf(latest, groups),
    },
    ...Array.from({ length: Math.min(newest - 1, 2) }, (_, i) => sheet(newest - 1 - i)),
  ]
  const upcoming: NewsletterIssue = {
    number: newest + 1,
    date: labels.next,
    subject: labels.nextSubject,
    stories: [],
  }
  return { publication: { name: labels.name, upcoming, recent } }
}
