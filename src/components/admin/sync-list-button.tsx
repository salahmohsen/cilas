'use client'

import { Button, toast, useDocumentInfo, useFormModified } from '@payloadcms/ui'
import { useState } from 'react'

import { postAction } from './post-action'

/** "Sync now" on a synced mailing list (src/collections/MailingLists.ts). */
export function SyncListButton() {
  const { id } = useDocumentInfo()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)

  const sync = async () => {
    setBusy(true)
    const { ok, body } = await postAction<{
      members?: number
      added?: number
      removed?: number
      failed?: number
    }>(`/api/mailing-lists/${id}/sync`, 'The sync failed. Try again.')
    setBusy(false)
    if (!ok) return
    const failed = body?.failed ? `, ${body.failed} failed` : ''
    toast.success(
      `${body?.members} members: ${body?.added} added, ${body?.removed} removed${failed}.`,
    )
    // The sidebar shows the new count and time.
    window.location.reload()
  }

  return (
    <div className="cilas-admin-stack">
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
