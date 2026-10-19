'use client'

import {
  Button,
  toast,
  useAuth,
  useConfig,
  useDocumentInfo,
  useForm,
  useFormFields,
  useLocale,
} from '@payloadcms/ui'
import { useState } from 'react'

const isAdmin = (roles: unknown) =>
  Array.isArray(roles) && roles.some((r) => r === 'admin' || r === 'super_admin')

const NOTES: Record<string, string> = {
  submitted: 'Submitted. An admin will review it, and you will get an email with the decision.',
  approved: 'Approved and published.',
  rejected: 'Declined. The note from the editor says why.',
}

/**
 * "Submit for review" on an article, course or publication
 * (src/lib/review-hooks.ts). It saves the form as it stands, as Publish does,
 * with the review status set to submitted, so nothing written is lost; the
 * server then emails the admins. Admins approve by publishing instead.
 */
export function SubmitForReview() {
  const { id, collectionSlug } = useDocumentInfo()
  const { submit } = useForm()
  const { user } = useAuth()
  const { config } = useConfig()
  const locale = useLocale()
  const [busy, setBusy] = useState(false)
  const status = useFormFields(([fields]) => fields['review.status']?.value as string | undefined)

  if (isAdmin(user?.roles)) return null
  if (!id)
    return <p className="field-description">Save a draft first, then submit it for review.</p>
  if (status && NOTES[status]) return <p className="field-description">{NOTES[status]}</p>

  const send = async () => {
    setBusy(true)
    const result = await submit({
      action: `${config.routes.api}/${collectionSlug}/${id}?depth=0&locale=${locale.code}`,
      method: 'PATCH',
      overrides: { _status: 'draft', review: { status: 'submitted' } },
    })
    setBusy(false)
    if (result) toast.success('Submitted for review. An admin has been emailed.')
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
      {status === 'changes_requested' ? (
        <p className="field-description">
          Changes were asked for: see the editor’s note, then submit again.
        </p>
      ) : null}
      <Button buttonStyle="primary" disabled={busy} margin={false} onClick={send}>
        {busy ? 'Submitting…' : 'Submit for review'}
      </Button>
    </div>
  )
}
