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

  if (isAdmin(user?.roles)) return <AdminDecision />
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

type Decision = 'approved' | 'changes_requested' | 'rejected'

const SENT: Record<Decision, string> = {
  approved: 'Approved and published. The owner has been told.',
  changes_requested: 'Sent back with your note. The owner has been told.',
  rejected: 'Declined. The owner has been told, with your note.',
}

/**
 * An admin's answer to a submission, beside the editor's note: approve and
 * publish, send it back for changes with the note, or decline it. Each saves
 * the form as it stands; the owner is emailed and notified with the note
 * (src/lib/review-hooks.ts).
 */
function AdminDecision() {
  const { id, collectionSlug } = useDocumentInfo()
  const { submit } = useForm()
  const { config } = useConfig()
  const locale = useLocale()
  const [busy, setBusy] = useState<Decision | null>(null)
  const status = useFormFields(([fields]) => fields['review.status']?.value as string | undefined)
  const note = useFormFields(
    ([fields]) => fields['review.review_note']?.value as string | undefined,
  )

  if (!id || status !== 'submitted') return null

  const decide = async (to: Decision) => {
    if (to !== 'approved' && !note?.trim()) {
      toast.error('Write the editor’s note first: it tells the owner what to change.')
      document.querySelector<HTMLTextAreaElement>('textarea[name="review.review_note"]')?.focus()
      return
    }
    setBusy(to)
    const result = await submit({
      action: `${config.routes.api}/${collectionSlug}/${id}?depth=0&locale=${locale.code}`,
      method: 'PATCH',
      overrides: {
        _status: to === 'approved' ? 'published' : 'draft',
        review: { status: to, review_note: note?.trim() || null },
      },
    })
    setBusy(null)
    if (result) toast.success(SENT[to])
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
      <p className="field-description">
        Submitted for review. To ask for changes or decline, write the editor’s note below first;
        the owner gets it by email.
      </p>
      <Button
        buttonStyle="primary"
        disabled={Boolean(busy)}
        margin={false}
        onClick={() => decide('approved')}
      >
        {busy === 'approved' ? 'Publishing…' : 'Approve and publish'}
      </Button>
      <Button
        buttonStyle="secondary"
        disabled={Boolean(busy)}
        margin={false}
        onClick={() => decide('changes_requested')}
      >
        {busy === 'changes_requested' ? 'Sending…' : 'Request changes'}
      </Button>
      <Button
        buttonStyle="error"
        disabled={Boolean(busy)}
        margin={false}
        onClick={() => decide('rejected')}
      >
        {busy === 'rejected' ? 'Sending…' : 'Decline'}
      </Button>
    </div>
  )
}
