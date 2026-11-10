'use client'

import { useAuth, useDocumentInfo, useLocale } from '@payloadcms/ui'
import { isAdminUser } from '@/access'

export function FullFormPreview() {
  const { id, collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  const { user } = useAuth()
  if (!id || !isAdminUser(user)) return null
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
