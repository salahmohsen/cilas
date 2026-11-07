import { type Locale } from '@/i18n/routing'
import config from '@payload-config'
import { getPayload } from 'payload'
import type { ReactNode } from 'react'
import type { Reader } from '@/api/articles.api'
import { resolveRichTextReferences } from '@/lib/resolve-rich-text-references'
import { RichTextReferencesProvider } from '@/components/rich-text-references'

export async function RichTextScope({
  data,
  locale,
  user = null,
  children,
}: {
  data: unknown
  locale: string
  user?: Reader
  children: ReactNode
}) {
  const payload = await getPayload({ config })
  const references = await resolveRichTextReferences(payload, data, {
    locale: locale as Locale,
    user,
  })
  return <RichTextReferencesProvider references={references}>{children}</RichTextReferencesProvider>
}
