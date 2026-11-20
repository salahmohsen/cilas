import { localeOf } from '@/i18n/routing'
import { getCourse } from '@/api/courses.api'
import { getCourseSessions } from '@/api/sessions.api'
import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'

import { courseDocument, documentToMarkdown } from '@/api/llms-document'

type Params = { params: Promise<{ locale: string; slug: string }> }

// Like the course page, what changes (registration, pricing) is computed from today's date.
export const revalidate = 3600

export async function GET(_request: Request, { params }: Params) {
  const { locale: raw, slug } = await params
  const locale: Locale = localeOf(raw)
  const payload = await getPayload({ config })
  // The file serves what an anonymous visitor may read.
  const course = await getCourse(payload, slug, { locale, reader: null })
  if (!course) return new Response(null, { status: 404 })

  const sessions = await getCourseSessions(payload, [course.id], { locale, reader: null })
  const markdown = await documentToMarkdown(
    await courseDocument(payload, course, sessions.get(course.id) ?? [], locale),
  )
  return new Response(markdown, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
