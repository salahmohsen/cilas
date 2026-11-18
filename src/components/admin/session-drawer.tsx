'use client'

import { useDocumentDrawer } from '@payloadcms/ui'
import { useEffect, useRef } from 'react'

type Props = {
  id: number
  /** The session was saved or deleted in the drawer. */
  onChanged: () => void
  /** The drawer is closed, however it was closed. */
  onClosed: () => void
}

/**
 * Payload's document drawer with one session's form, open from the moment it
 * is shown. `useDocumentDrawer` fixes the document when it is called, so a
 * host shows one of these for each session it opens and drops it on close.
 */
export function SessionDrawer({ id, onChanged, onClosed }: Props) {
  const [DocumentDrawer, , { openDrawer, isDrawerOpen }] = useDocumentDrawer({
    collectionSlug: 'sessions',
    id,
  })
  useEffect(() => openDrawer(), [openDrawer])

  const wasOpen = useRef(false)
  useEffect(() => {
    if (isDrawerOpen) wasOpen.current = true
    else if (wasOpen.current) onClosed()
  }, [isDrawerOpen, onClosed])

  return <DocumentDrawer onSave={onChanged} onDelete={onChanged} />
}
