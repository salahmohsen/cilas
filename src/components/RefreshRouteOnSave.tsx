'use client'

import { RefreshRouteOnSave as PayloadLivePreview } from '@payloadcms/live-preview-react'
import { useRouter } from 'next/navigation'
import React from 'react'

import { env } from '@/env'

/**
 * Re-renders the route when Payload autosaves, so the live-preview iframe
 * reflects the document as it is persisted.
 *
 * This handles only the save half of live preview. The as-you-type half comes
 * from `useLivePreview` in the client component that renders the document.
 *
 * @see https://payloadcms.com/docs/live-preview/server
 */
export const RefreshRouteOnSave: React.FC = () => {
  const router = useRouter()

  return (
    <PayloadLivePreview refresh={router.refresh} serverURL={env.NEXT_PUBLIC_SERVER_URL} />
  )
}
