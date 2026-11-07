'use client'

import {
  Button,
  ConfirmationModal,
  toast,
  useDocumentInfo,
  useFormFields,
  useFormModified,
  useModal,
} from '@payloadcms/ui'
import { useState } from 'react'

import { postAction } from './post-action'

/** "Send test to me" and "Send to the list" on a newsletter issue (src/forms/newsletter-send.ts). */
export function NewsletterActions() {
  const { id } = useDocumentInfo()
  const { openModal } = useModal()
  const modified = useFormModified()
  const [busy, setBusy] = useState(false)
  const sentAt = useFormFields(([fields]) => fields.sent_at?.value as string | undefined)

  if (!id) return <p className="field-description">Save the issue to preview, test and send it.</p>
  if (sentAt) return <p className="field-description">Sent {new Date(sentAt).toLocaleString()}.</p>

  const call = async (action: 'test' | 'send') => {
    setBusy(true)
    const { ok, body } = await postAction<{ to?: string }>(
      `/api/newsletters/${id}/${action}`,
      'Sending failed. Try again.',
    )
    setBusy(false)
    if (!ok) return
    if (action === 'test') {
      toast.success(`Test sent to ${body?.to}.`)
      return
    }
    // The sidebar shows the send time; the issue is now published.
    window.location.reload()
  }

  const slug = `newsletter-send-${id}`
  return (
    <div className="cilas-admin-stack">
      {modified ? (
        <p className="field-description">Save first: tests and sends use the saved issue.</p>
      ) : null}
      <Button
        buttonStyle="secondary"
        disabled={busy || modified}
        margin={false}
        onClick={() => call('test')}
      >
        Send test to me
      </Button>
      <Button
        buttonStyle="primary"
        disabled={busy || modified}
        margin={false}
        onClick={() => openModal(slug)}
      >
        Send to the list
      </Button>
      <ConfirmationModal
        modalSlug={slug}
        heading="Send this issue to its mailing list?"
        body={
          <p>
            This sends the saved issue now to the list in “Send to” (empty: the signup list) and
            publishes it to the archive. You cannot send it again.
          </p>
        }
        confirmLabel="Send"
        confirmingLabel="Sending…"
        onConfirm={() => call('send')}
      />
    </div>
  )
}
