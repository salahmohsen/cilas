'use client'

import { useDocumentInfo, useLocale } from '@payloadcms/ui'

export function FullFormPreview() {
  const { id, collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  if (!id) return null
  return (
    <a
      className="btn btn--style-secondary"
      href={`/${locale.code}/forms/preview?context=${collectionSlug}&id=${id}`}
      target="_blank"
      rel="noopener noreferrer"
    >
      Preview full form
    </a>
  )
}
