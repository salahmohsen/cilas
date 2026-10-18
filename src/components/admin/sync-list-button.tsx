'use client'

import { Button, toast, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'

/** "Sync now" on a synced mailing list (src/collections/MailingLists.ts). */
export function SyncListButton() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)

  const sync = async () => {
    setBusy(true)
    const res = await fetch(`/api/mailing-lists/${id}/sync`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as {
      error?: string
      members?: number
      added?: number
      removed?: number
      failed?: number
    } | null
    setBusy(false)
    if (!res?.ok) {
      toast.error(body?.error ?? 'The sync failed. Try again.')
      return
    }
    const failed = body?.failed ? `, ${body.failed} failed` : ''
    toast.success(
      `${body?.members} members: ${body?.added} added, ${body?.removed} removed${failed}.`,
    )
    // The sidebar shows the new count and time.
    window.location.reload()
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '1rem' }}>
      <Button buttonStyle="secondary" disabled={busy || modified} margin={false} onClick={sync}>
        {busy ? 'Syncing…' : 'Sync now'}
      </Button>
      <p className="field-description">
        {modified
          ? 'Save first: the sync uses the saved list.'
          : 'Saving the list and sending a newsletter sync it too. A first sync of many members takes a few minutes.'}
      </p>
    </div>
  )
}
