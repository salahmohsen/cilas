'use client'

import { Button, useDocumentInfo, useLocale } from '@payloadcms/ui'

export function FullFormPreview() {
  const { id, collectionSlug } = useDocumentInfo()
  const locale = useLocale()
  if (!id) return null
  return (
    <div className="sidebar-action">
      <Button
        buttonStyle="secondary"
        el="anchor"
        margin={false}
        newTab
        size="medium"
        url={`/${locale.code}/forms/preview?context=${collectionSlug}&id=${id}`}
      >
        Preview full form
      </Button>
    </div>
  )
}
