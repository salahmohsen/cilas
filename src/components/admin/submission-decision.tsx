'use client'

import {
  Button,
  ConfirmationModal,
  toast,
  useDocumentInfo,
  useFormFields,
  useModal,
} from '@payloadcms/ui'
import { useState } from 'react'

/**
 * Accept and Reject on an application (src/forms/applications.ts). Accepting
 * finds or makes the applicant's account and hidden person, gives them a
 * membership or an enrollment, and emails them. Shown only for submissions
 * that name a programme or a course.
 */
export function SubmissionDecision() {
  const { id } = useDocumentInfo()
  const { openModal } = useModal()
  const [busy, setBusy] = useState(false)
  const { status, target, name, email } = useFormFields(([fields]) => {
    const answer = (field: string) => {
      const key = Object.keys(fields).find(
        (k) => /^submissionData\.\d+\.field$/.test(k) && fields[k]?.value === field,
      )
      return key ? String(fields[key.replace(/field$/, 'value')]?.value ?? '') : ''
    }
    return {
      status: fields.status?.value as string | undefined,
      target: fields.target?.value as { relationTo: string } | null | undefined,
      name: answer('name'),
      email: answer('email'),
    }
  })

  if (!id || !target) return null
  if (status === 'accepted') {
    return <p className="field-description">Accepted. See the result below.</p>
  }

  const what = target.relationTo === 'programmes' ? 'a membership in the programme' : 'an enrollment in the course'
  const slug = (action: string) => `submission-${action}-${id}`

  const run = async (action: 'accept' | 'reject') => {
    setBusy(true)
    const res = await fetch(`/api/form-submissions/${id}/${action}`, {
      method: 'POST',
      credentials: 'include',
    }).catch(() => null)
    const body = (await res?.json().catch(() => null)) as { error?: string; emailed?: boolean } | null
    if (!res?.ok) {
      setBusy(false)
      toast.error(body?.error ?? 'The decision failed. Try again.')
      return
    }
    if (action === 'accept' && body?.emailed === false) {
      toast.warning('Accepted, but the email did not send. Contact the applicant yourself.')
    }
    // The sidebar shows the new status and the records accepting made.
    window.location.reload()
  }

  return (
    <div style={{ display: 'grid', gap: '0.5rem', marginBlock: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button buttonStyle="primary" disabled={busy} margin={false} onClick={() => openModal(slug('accept'))}>
          Accept
        </Button>
        {status === 'new' ? (
          <Button buttonStyle="secondary" disabled={busy} margin={false} onClick={() => openModal(slug('reject'))}>
            Reject
          </Button>
        ) : null}
      </div>
      <ConfirmationModal
        modalSlug={slug('accept')}
        heading="Accept this application?"
        body={
          <p>
            This finds or makes an account for {email || 'the applicant'}, a hidden person for{' '}
            {name || 'them'}, and {what}. Then it emails {email || 'them'} how to sign in.
          </p>
        }
        confirmLabel="Accept"
        confirmingLabel="Accepting…"
        onConfirm={() => run('accept')}
      />
      <ConfirmationModal
        modalSlug={slug('reject')}
        heading="Reject this application?"
        body={<p>This marks it rejected. It makes nothing and sends no email.</p>}
        confirmLabel="Reject"
        confirmingLabel="Rejecting…"
        onConfirm={() => run('reject')}
      />
    </div>
  )
}
