import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'

import { getArticleForReading } from '@/api/articles.api'
import { articleDocument, documentToMarkdown } from '@/lib/llms-document'

type Params = { params: Promise<{ locale: string; slug: string }> }

// The article body does not change behind the cached page.
export const revalidate = 3600

export async function GET(_request: Request, { params }: Params) {
  const { locale: raw, slug } = await params
  const locale: Locale = raw === 'ar' ? 'ar' : 'en'
  const payload = await getPayload({ config })
  const reading = await getArticleForReading(payload, slug, { locale })
  if (!reading) return new Response(null, { status: 404 })

  const markdown = await documentToMarkdown(
    await articleDocument(payload, reading.article, reading.body, locale),
  )
  return new Response(markdown, {
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
