'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import type { Applicant } from '@/forms/applicants'
import { applicantsCopy } from './applicants-copy'
import type { Decision, DecisionResult } from './applicant-decide'
import styles from './applicants.module.css'

/** How long the success state stays on the button before the dialog closes. */
const SUCCESS_MS = 900

/**
 * Asks the admin to confirm one course's decision. The body lists, from the real
 * decision code (forms/application-decision.ts), what the decision does and who hears of it.
 */
export function DecisionDialog({
  application: a,
  ask,
  ar,
  onClose,
  decide,
  onDone,
  returnFocus,
}: {
  application: Applicant
  /** The course and decision to confirm; null while the dialog is closed. */
  ask: { course: Applicant['choices'][number]; decision: Decision } | null
  ar: boolean
  onClose: () => void
  /** Sends the decision and says whether the applicant's email failed. Rejects with the reason when the decision fails. */
  decide: (course: number, decision: Decision) => Promise<DecisionResult>
  onDone: (course: number, decision: Decision, result: DecisionResult) => void
  returnFocus: () => HTMLElement | null
}) {
  const t = applicantsCopy(ar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Keep the last question while the dialog leaves, so its copy does not blink out.
  const [shown, setShown] = useState<NonNullable<typeof ask> | null>(null)
  if (ask && ask !== shown) setShown(ask)
  const name = a.name || t.untitled
  const accepting = shown?.decision === 'accept'
  const course = shown?.course.title ?? ''
  const effects = accepting ? t.acceptEffects(a.email, course) : t.rejectEffects(a.email, course)
  return (
    <Dialog
      open={ask !== null}
      onOpenChange={(open) => {
        if (!open && !busy) onClose()
      }}
    >
      <DialogContent
        className={`arc-scope ${styles.dialog}`}
        dir={ar ? 'rtl' : 'ltr'}
        title={accepting ? t.acceptTitle(course) : t.rejectTitle(course)}
        description={accepting ? t.acceptBody(name, course) : t.rejectBody(name, course)}
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
            successLabel={accepting ? t.decisions.accepted : t.decisions.rejected}
            resetAfterMs={0}
            onAction={() => send(shown!.course.course, shown!.decision)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )

  async function send(course: number, next: Decision) {
    setBusy(true)
    setError('')
    let result: DecisionResult
    try {
      result = await decide(course, next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed)
      setBusy(false)
      throw e
    }
    window.setTimeout(() => {
      setBusy(false)
      onDone(course, next, result)
    }, SUCCESS_MS)
  }
}
