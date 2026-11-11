'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import type { Applicant } from '@/forms/applicants'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

export type Decision = 'accept' | 'reject'

/** How long the success state stays on the button before the dialog closes. */
const SUCCESS_MS = 900

/**
 * Asks the admin to confirm a decision. The body lists, from the real decision
 * code (forms/application-decision.ts), what the decision does and who hears of it.
 */
export function DecisionDialog({
  application: a,
  decision,
  ar,
  onClose,
  decide,
  onDone,
  returnFocus,
}: {
  application: Applicant
  decision: Decision | null
  ar: boolean
  onClose: () => void
  /** Sends the decision and says whether the applicant's email failed. Rejects with the reason when the decision fails. */
  decide: (decision: Decision) => Promise<boolean>
  onDone: (decision: Decision, emailFailed: boolean) => void
  returnFocus: () => HTMLElement | null
}) {
  const t = applicantsCopy(ar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Keep the last decision while the dialog leaves, so its copy does not blink out.
  const [shown, setShown] = useState<Decision>('reject')
  if (decision && decision !== shown) setShown(decision)
  const name = a.name || t.untitled
  const accepting = shown === 'accept'
  const effects = accepting
    ? t.acceptEffects(
        a.email,
        a.choices.filter((c) => c.accepted).map((c) => c.title),
        a.target === 'programmes',
      )
    : t.rejectEffects(a.email)
  return (
    <Dialog
      open={decision !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className={`arc-scope ${styles.dialog}`}
        dir={ar ? 'rtl' : 'ltr'}
        title={accepting ? t.acceptTitle : t.rejectTitle}
        description={accepting ? t.acceptBody(name) : t.rejectBody(name)}
        closeLabel={t.close}
        onCloseAutoFocus={(e) => {
          e.preventDefault()
          returnFocus()?.focus()
        }}
        onEscapeKeyDown={(e) => {
          if (busy) e.preventDefault()
        }}
        onPointerDownOutside={(e) => {
          if (busy) e.preventDefault()
        }}
      >
        <Alert tone="info" title={t.whatNext}>
          {/* Alert wraps its children in a paragraph, so the list is spans with list roles. */}
          <span className={styles.effects} role="list">
            {effects.map((line) => (
              <span key={line} role="listitem">
                {line}
              </span>
            ))}
          </span>
        </Alert>
        {error && <Alert tone="danger" title={error} />}
        <div className={styles.actions}>
          <DialogClose asChild>
            <Button variant="secondary" disabled={busy}>
              {t.cancel}
            </Button>
          </DialogClose>
          <ActionButton
            label={accepting ? t.accept : t.reject}
            pendingLabel={accepting ? t.accepting : t.rejecting}
            successLabel={accepting ? t.statuses.accepted : t.statuses.rejected}
            resetAfterMs={0}
            onAction={() => send(shown)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )

  async function send(next: Decision) {
    setBusy(true)
    setError('')
    let emailFailed: boolean
    try {
      emailFailed = await decide(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed)
      setBusy(false)
      throw e
    }
    window.setTimeout(() => {
      setBusy(false)
      onDone(next, emailFailed)
    }, SUCCESS_MS)
  }
}
