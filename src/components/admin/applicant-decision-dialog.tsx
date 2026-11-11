'use client'

import { useState } from 'react'
import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import type { Applicant } from '@/forms/applicants'
import { applicantsCopy } from './applicants-copy'
import type { Decision, DecisionResult, Entry } from './applicant-decide'
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
  ask: { entry: Entry; decision: Decision } | null
  ar: boolean
  onClose: () => void
  /** Sends the decision and says whether the applicant's email failed. Rejects with the reason when the decision fails. */
  decide: (entry: Entry, decision: Decision) => Promise<DecisionResult>
  onDone: (entry: Entry, decision: Decision, result: DecisionResult) => void
  returnFocus: () => HTMLElement | null
}) {
  const t = applicantsCopy(ar)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // Keep the last question while the dialog leaves, so its copy does not blink out.
  const [shown, setShown] = useState<NonNullable<typeof ask> | null>(null)
  if (ask && ask !== shown) setShown(ask)
  const name = a.name || t.untitled
  const kind =
    shown?.decision === 'reopen' ? 'reopen' : shown?.decision === 'accept' ? 'accept' : 'reject'
  const title = shown?.entry.title ?? ''
  const programme = shown?.entry.course === null
  const was = shown?.entry.decision === 'accepted' ? 'accepted' : 'rejected'
  const copy = {
    accept: {
      heading: t.acceptTitle(title),
      body: t.acceptBody(name, title),
      effects: t.acceptEffects(a.email, title, programme),
      label: t.accept,
      pending: t.accepting,
      done: t.decisions.accepted,
    },
    reject: {
      heading: t.rejectTitle(title),
      body: t.rejectBody(name, title),
      effects: t.rejectEffects(a.email, title, programme),
      label: t.reject,
      pending: t.rejecting,
      done: t.decisions.rejected,
    },
    reopen: {
      heading: t.reopenTitle(title),
      body: t.reopenBody(name, title),
      effects: t.reopenEffects(title, was, programme),
      label: t.reopen,
      pending: t.reopening,
      done: t.reopened,
    },
  }[kind]
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
        title={copy.heading}
        description={copy.body}
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
            {copy.effects.map((line) => (
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
            label={copy.label}
            pendingLabel={copy.pending}
            successLabel={copy.done}
            resetAfterMs={0}
            onAction={() => send(shown!.entry, shown!.decision)}
          />
        </div>
      </DialogContent>
    </Dialog>
  )

  async function send(entry: Entry, next: Decision) {
    setBusy(true)
    setError('')
    let result: DecisionResult
    try {
      result = await decide(entry, next)
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed)
      setBusy(false)
      throw e
    }
    window.setTimeout(() => {
      setBusy(false)
      onDone(entry, next, result)
    }, SUCCESS_MS)
  }
}
