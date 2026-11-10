'use client'

import {
  Button,
  ConfirmationModal,
  toast,
  useDocumentInfo,
  useFormFields,
  useModal,
  useForm,
  useAuth,
} from '@payloadcms/ui'
import { useState } from 'react'

import { isAdminUser } from '@/access'
import { postAction } from './post-action'

export function SubmissionDecision() {
  const { user } = useAuth()
  const { submit } = useForm()
  const { id } = useDocumentInfo()
  const { openModal } = useModal()
  const [busy, setBusy] = useState(false)
  const { status, target, name, email, choiceCount, acceptedCount } = useFormFields(([fields]) => {
    const answer = (field: string) => {
      const key = Object.keys(fields).find(
        (k) => /^submissionData\.\d+\.field$/.test(k) && fields[k]?.value === field,
      )
      return key ? String(fields[key.replace(/field$/, 'value')]?.value ?? '') : ''
    }
    const accepted = Object.keys(fields).filter((key) => /^choices\.\d+\.accepted$/.test(key))
    return {
      choiceCount: accepted.length,
      acceptedCount: accepted.filter((key) => fields[key]?.value === true).length,
      status: fields.status?.value as string | undefined,
      target: fields.target?.value as { relationTo: string } | null | undefined,
      name: answer('name'),
      email: answer('email'),
    }
  })

  if (!id || !target || !isAdminUser(user)) return null
  if (status === 'accepted') {
    return <p className="field-description">Accepted. See the result below.</p>
  }

  const noAcceptedCourses =
    (target.relationTo === 'cycles' || choiceCount > 0) && acceptedCount === 0
  const what =
    target.relationTo === 'programmes'
      ? 'a membership in the programme'
      : 'enrollments for the accepted courses'
  const slug = (action: string) => `submission-${action}-${id}`

  const run = async (action: 'accept' | 'reject') => {
    setBusy(true)
    if (action === 'accept') {
      const saved = await submit({ disableSuccessStatus: true })
      if (!saved?.res.ok) {
        setBusy(false)
        return
      }
    }
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
          disabled={busy || noAcceptedCourses}
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
      {noAcceptedCourses ? <p>Select at least one course to approve.</p> : null}
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
