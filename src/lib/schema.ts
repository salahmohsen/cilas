import { env } from '@/env'
import { pathOf } from '@/lib/paths'
import { plainText } from '@/lib/plaintext'
import type { Article, Course, Person } from '@/payload-types'

export const CONTEXT = 'https://schema.org'

const LOGO = '/assets/images/logo.webp'

export const absoluteUrl = (path: string): string =>
  new URL(path, env.NEXT_PUBLIC_SERVER_URL).toString()

export const plainOf = (data: unknown): string =>
  data
    ? plainText({ data: data as { root: unknown } })
        .replace(/\s+/g, ' ')
        .trim()
    : ''

export const personRef = (person: Person, locale: string) => {
  const page = pathOf('people', person, locale)
  return {
    '@type': 'Person',
    name: person.name,
    ...(page ? { url: absoluteUrl(page) } : {}),
  }
}

export const organizationSchema = ({
  siteName,
  description,
  location,
  sameAs,
}: {
  siteName: string
  description: string
  /** The address the footer shows, when the current place has one. */
  location?: { address: string; mapUrl: string | null }
  sameAs: string[]
}) => ({
  '@context': CONTEXT,
  '@type': 'EducationalOrganization',
  name: siteName,
  description,
  url: absoluteUrl('/'),
  logo: absoluteUrl(LOGO),
  ...(sameAs.length ? { sameAs } : {}),
  ...(location && location.address
    ? {
        address: {
          '@type': 'PostalAddress',
          streetAddress: location.address,
          addressCountry: 'EG',
        },
        ...(location.mapUrl ? { hasMap: location.mapUrl } : {}),
      }
    : {}),
})

const stamp = (value: string | null | undefined): string | undefined => {
  const date = value ? new Date(value) : null
  return date && !Number.isNaN(date.getTime()) ? date.toISOString() : undefined
}

export const websiteSchema = ({ siteName, locale }: { siteName: string; locale: string }) => ({
  '@context': CONTEXT,
  '@type': 'WebSite',
  name: siteName,
  url: absoluteUrl('/'),
  inLanguage: locale,
})

export const breadcrumbSchema = (crumbs: { name: string; path?: string | null }[]) => ({
  '@context': CONTEXT,
  '@type': 'BreadcrumbList',
  itemListElement: crumbs.map((crumb, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    name: crumb.name,
    ...(crumb.path ? { item: absoluteUrl(crumb.path) } : {}),
  })),
})

export const itemListSchema = (urls: string[]) =>
  urls.length < 3
    ? null // A carousel needs at least three courses to list.
    : {
        '@context': CONTEXT,
        '@type': 'ItemList',
        itemListElement: urls.map((url, i) => ({ '@type': 'ListItem', position: i + 1, url })),
      }

export const articleSchema = ({
  article,
  locale,
  inLanguage,
  title,
  description,
  image,
  authors,
  publisherName,
}: {
  article: Article
  /** The URL's language; `inLanguage` is what the text itself is in. */
  locale: string
  inLanguage: string
  title: string
  description: string
  image: string | null
  authors: Person[]
  publisherName: string
}) => {
  const page = pathOf('articles', article, locale)
  return {
    '@context': CONTEXT,
    '@type': 'Article',
    headline: title,
    description,
    inLanguage,
    datePublished: stamp(article.published_date) ?? stamp(article.createdAt),
    dateModified: stamp(article.updatedAt),
    ...(image ? { image: [image] } : {}),
    ...(authors.length ? { author: authors.map((p) => personRef(p, locale)) } : {}),
    ...(page ? { mainEntityOfPage: { '@type': 'WebPage', '@id': absoluteUrl(page) } } : {}),
    publisher: {
      '@type': 'Organization',
      name: publisherName,
      logo: { '@type': 'ImageObject', url: absoluteUrl(LOGO) },
    },
  }
}

export const personSchema = ({ person, locale }: { person: Person; locale: string }) => {
  const bio = plainOf(person.bio)
  const photoUrl = typeof person.photo === 'object' && person.photo?.url ? person.photo.url : null
  const sameAs = [person.website, ...(person.social_links ?? []).map((s) => s.url)].filter(
    (link): link is string => Boolean(link),
  )
  const page = pathOf('people', person, locale)
  return {
    '@context': CONTEXT,
    '@type': 'ProfilePage',
    dateModified: stamp(person.updatedAt),
    dateCreated: stamp(person.createdAt),
    mainEntity: {
      '@type': 'Person',
      name: person.name,
      ...(page ? { url: absoluteUrl(page) } : {}),
      ...(bio ? { description: bio } : {}),
      ...(photoUrl ? { image: absoluteUrl(photoUrl) } : {}),
      ...(sameAs.length ? { sameAs } : {}),
    },
  }
}

/** A course detail page, paired with the study index's course-list markup. */
export const courseSchema = ({
  course,
  locale,
  siteName,
  instructors,
}: {
  course: Course
  locale: string
  siteName: string
  instructors: Person[]
}) => {
  const description =
    (course.meta?.description || course.summary || course.subtitle || '').trim() ||
    plainOf(course.description)
  if (!description) return null

  const uses = course.location ?? []
  const hybrid = uses.includes('HYBRID') || (uses.includes('ONLINE') && uses.includes('OFFLINE'))
  const courseMode = hybrid
    ? 'Hybrid'
    : uses.includes('ONLINE')
      ? 'Online'
      : uses.includes('OFFLINE')
        ? 'Onsite'
        : null
  const page = pathOf('courses', course, locale)

  return {
    '@context': CONTEXT,
    '@type': 'Course',
    name: course.title,
    ...(page ? { url: absoluteUrl(page) } : {}),
    description,
    inLanguage: locale,
    provider: { '@type': 'EducationalOrganization', name: siteName, url: absoluteUrl('/') },
    ...(courseMode || instructors.length
      ? {
          hasCourseInstance: [
            {
              '@type': 'CourseInstance',
              ...(courseMode ? { courseMode } : {}),
              ...(instructors.length
                ? { instructor: instructors.map((p) => personRef(p, locale)) }
                : {}),
            },
          ],
        }
      : {}),
  }
}
