'use client'

import { isAdminUser } from '@/access'

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

const NOTES: Record<string, string> = {
  submitted: 'Submitted. An admin will review it, and you will get an email with the decision.',
  approved: 'Approved and published.',
  rejected: 'Declined. The note from the editor says why.',
}

type Request = 'changes' | 'removal'

/**
 * "Submit for review" on an article, course or publication
 * (src/lib/review-hooks.ts). It saves the form as it stands, as Publish does,
 * with the review status set to submitted, so nothing written is lost; the
 * server then emails the admins. Admins approve by publishing instead.
 *
 * On a published document the owner's edits are a draft beside it, and the
 * site keeps the published one: they submit the changes, or ask for it to
 * come down. Only an admin publishes or removes it.
 */
export function SubmitForReview() {
  const { id, collectionSlug, hasPublishedDoc } = useDocumentInfo()
  const { submit } = useForm()
  const { user } = useAuth()
  const { config } = useConfig()
  const locale = useLocale()
  const [busy, setBusy] = useState<Request | null>(null)
  const status = useFormFields(([fields]) => fields['review.status']?.value as string | undefined)
  const request = useFormFields(
    ([fields]) => fields['review.request']?.value as Request | null | undefined,
  )

  if (isAdminUser(user)) return <AdminDecision />
  if (!id)
    return <p className="field-description">Save a draft first, then submit it for review.</p>
  if (status === 'submitted' && request === 'removal')
    return (
      <p className="field-description">
        You asked for it to come off the site. An admin will decide, and you will get the answer.
      </p>
    )
  const live = hasPublishedDoc && status !== 'submitted'
  if (!live && status && NOTES[status]) return <p className="field-description">{NOTES[status]}</p>

  const send = async (to: Request) => {
    setBusy(to)
    const result = await submit({
      action: `${config.routes.api}/${collectionSlug}/${id}?depth=0&locale=${locale.code}`,
      method: 'PATCH',
      overrides: {
        _status: 'draft',
        review: { status: 'submitted', ...(live ? { request: to } : {}) },
      },
    })
    setBusy(null)
    if (result)
      toast.success(
        to === 'removal'
          ? 'Removal asked for. An admin has been emailed.'
          : 'Submitted for review. An admin has been emailed.',
      )
  }

  if (live)
    return (
      <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
        <p className="field-description">
          {status === 'changes_requested'
            ? 'Changes were asked for: see the editor’s note, then submit again.'
            : status === 'rejected'
              ? 'Your last request was declined; the editor’s note says why.'
              : 'Published. Your edits save as a draft: the site keeps the published version until an admin approves them.'}
        </p>
        <Button
          buttonStyle="primary"
          disabled={Boolean(busy)}
          margin={false}
          onClick={() => send('changes')}
        >
          {busy === 'changes' ? 'Submitting…' : 'Submit changes for review'}
        </Button>
        <Button
          buttonStyle="secondary"
          disabled={Boolean(busy)}
          margin={false}
          onClick={() => send('removal')}
        >
          {busy === 'removal' ? 'Sending…' : 'Ask to remove it from the site'}
        </Button>
      </div>
    )

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
      {status === 'changes_requested' ? (
        <p className="field-description">
          Changes were asked for: see the editor’s note, then submit again.
        </p>
      ) : null}
      <Button
        buttonStyle="primary"
        disabled={Boolean(busy)}
        margin={false}
        onClick={() => send('changes')}
      >
        {busy ? 'Submitting…' : 'Submit for review'}
      </Button>
    </div>
  )
}

type Decision = 'approved' | 'changes_requested' | 'rejected' | 'removed'

const SENT: Record<Decision, string> = {
  approved: 'Approved and published. The owner has been told.',
  changes_requested: 'Sent back with your note. The owner has been told.',
  rejected: 'Declined. The owner has been told, with your note.',
  removed: 'Taken off the site and returned to the owner as a draft. They have been told.',
}

/** What each decision saves. Removal unpublishes: the owner gets it back as a draft. */
const SAVES: Record<Decision, { _status: 'draft' | 'published'; status: string }> = {
  approved: { _status: 'published', status: 'approved' },
  changes_requested: { _status: 'draft', status: 'changes_requested' },
  rejected: { _status: 'draft', status: 'rejected' },
  removed: { _status: 'draft', status: 'draft' },
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
  const request = useFormFields(
    ([fields]) => fields['review.request']?.value as Request | null | undefined,
  )

  if (!id || status !== 'submitted') return null

  const decide = async (to: Decision) => {
    if ((to === 'changes_requested' || to === 'rejected') && !note?.trim()) {
      toast.error('Write the editor’s note first: it tells the owner what to change.')
      document.querySelector<HTMLTextAreaElement>('textarea[name="review.review_note"]')?.focus()
      return
    }
    setBusy(to)
    const result = await submit({
      action: `${config.routes.api}/${collectionSlug}/${id}?depth=0&locale=${locale.code}`,
      method: 'PATCH',
      overrides: {
        _status: SAVES[to]._status,
        review: { status: SAVES[to].status, review_note: note?.trim() || null },
      },
    })
    setBusy(null)
    if (result) toast.success(SENT[to])
  }

  if (request === 'removal')
    return (
      <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
        <p className="field-description">
          The owner asks for this to come off the site. Removing it unpublishes it and gives it back
          to them as a draft. To decline, write the editor’s note below first.
        </p>
        <Button
          buttonStyle="primary"
          disabled={Boolean(busy)}
          margin={false}
          onClick={() => decide('removed')}
        >
          {busy === 'removed' ? 'Removing…' : 'Remove from the site'}
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

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '0 1rem' }}>
      <p className="field-description">
        {request === 'changes'
          ? 'Changes to the published version, submitted for review. The site shows the published one until you approve.'
          : 'Submitted for review.'}{' '}
        To ask for changes or decline, write the editor’s note below first; the owner gets it by
        email.
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
