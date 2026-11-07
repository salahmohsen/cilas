import { type Locale, otherLocale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'

import { courseDocument, documentToMarkdown } from '@/lib/llms-document'

type Params = { params: Promise<{ locale: string; slug: string }> }

// Like the course page, what changes (registration, pricing) is computed from today's date.
export const revalidate = 3600

export async function GET(_request: Request, { params }: Params) {
  const { locale: raw, slug } = await params
  const locale: Locale = raw === 'ar' ? 'ar' : 'en'
  const payload = await getPayload({ config })
  const { docs } = await payload.find({
    collection: 'courses',
    where: {
      and: [
        { slug: { equals: slug } },
        { tier: { equals: 'public' } },
        { _status: { equals: 'published' } },
      ],
    },
    limit: 1,
    depth: 2,
    joins: false,
    // The file serves what an anonymous visitor may read.
    overrideAccess: false,
    locale,
    fallbackLocale: otherLocale(locale),
  })
  const course = docs[0]
  if (!course) return new Response(null, { status: 404 })

  const markdown = await documentToMarkdown(await courseDocument(payload, course, locale))
  return new Response(markdown, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
