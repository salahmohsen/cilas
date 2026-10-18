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

/** "Send test to me" and "Send to subscribers" on a newsletter issue (src/forms/newsletter-send.ts). */
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
    const res = await fetch(`/api/newsletters/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { error?: string; to?: string } | null
    setBusy(false)
    if (!res?.ok) {
      toast.error(body?.error ?? 'Sending failed. Try again.')
      return
    }
    if (action === 'test') {
      toast.success(`Test sent to ${body?.to}.`)
      return
    }
    // The sidebar shows the send time; the issue is now published.
    window.location.reload()
  }

  const slug = `newsletter-send-${id}`
  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '1rem' }}>
      {modified ? <p className="field-description">Save first: tests and sends use the saved issue.</p> : null}
      <Button buttonStyle="secondary" disabled={busy || modified} margin={false} onClick={() => call('test')}>
        Send test to me
      </Button>
      <Button buttonStyle="primary" disabled={busy || modified} margin={false} onClick={() => openModal(slug)}>
        Send to subscribers
      </Button>
      <ConfirmationModal
        modalSlug={slug}
        heading="Send this issue to every subscriber?"
        body={<p>This sends the saved issue now and publishes it to the archive. You cannot send it again.</p>}
        confirmLabel="Send"
        confirmingLabel="Sending…"
        onConfirm={() => call('send')}
      />
    </div>
  )
}
