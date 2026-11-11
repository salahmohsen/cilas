'use client'

import {
  Button,
  ConfirmationModal,
  toast,
  useDocumentInfo,
  useFormFields,
  useModal,
  useAuth,
} from '@payloadcms/ui'
import Link from 'next/link'
import { useState } from 'react'

import { isAdminUser } from '@/access'
import { postAction } from './post-action'

export function SubmissionDecision() {
  const { user } = useAuth()
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

  if (!id || !target || !isAdminUser(user)) return null
  // A course application is decided course by course, in Applicants.
  if (target.relationTo !== 'programmes') {
    return (
      <p className="field-description">
        Decide each course in <Link href="/admin/applicants">Applicants</Link>. This status follows
        from those decisions.
      </p>
    )
  }
  if (status === 'accepted') {
    return <p className="field-description">Accepted. See the result below.</p>
  }

  const slug = (action: string) => `submission-${action}-${id}`

  const run = async (action: 'accept' | 'reject') => {
    setBusy(true)
    const { ok, body } = await postAction<{ emailed?: boolean }>(
      `/api/form-submissions/${id}/${action}`,
      'The decision failed. Try again.',
    )
    if (!ok) {
      setBusy(false)
      return
    }
    if (action === 'accept' && body?.emailed === false) {
      toast.warning('Accepted, but the email did not send. Contact the applicant yourself.')
    }
    window.location.reload()
  }

  return (
    <div className="cilas-admin-stack">
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <Button
          buttonStyle="primary"
          disabled={busy}
          margin={false}
          onClick={() => openModal(slug('accept'))}
        >
          Accept
        </Button>
        {status === 'new' ? (
          <Button
            buttonStyle="secondary"
            disabled={busy}
            margin={false}
            onClick={() => openModal(slug('reject'))}
          >
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
            {name || 'them'}, and a membership in the programme. Then it emails {email || 'them'}{' '}
            how to sign in.
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
