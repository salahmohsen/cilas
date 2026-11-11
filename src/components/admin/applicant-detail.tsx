'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { X } from 'lucide-react'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { PayloadForm } from '@/components/forms/payload-form'
import type { Applicant } from '@/forms/applicants'
import {
  entriesOf,
  sendDecision,
  type Decision,
  type DecisionResult,
  type Entry,
} from './applicant-decide'
import { DecisionDialog } from './applicant-decision-dialog'
import { CourseTile, CourseTiles, DecisionBadge, EmailLine } from './applicant-parts'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

type Ask = (entry: Entry, decision: Decision) => (e: MouseEvent<HTMLElement>) => void

/**
 * What an admin can do with one entry. A pending one is accepted or rejected.
 * A decided one can be reopened, and its email sent again if it did not go out.
 * An accepted programme application has a membership, so it is not reopened here.
 */
function EntryActions({
  entry,
  ar,
  onAsk,
  onResend,
  resending,
  withBadge,
}: {
  entry: Entry
  ar: boolean
  onAsk: Ask
  onResend: (entry: Entry) => void
  resending: boolean
  /** The tiles above already show the badge; a list row shows it itself. */
  withBadge: boolean
}) {
  const t = applicantsCopy(ar)
  if (entry.decision === 'pending') {
    return (
      <div className={styles.decisionButtons}>
        <Button
          variant="danger"
          className={styles.reject}
          aria-label={`${t.reject}: ${entry.title}`}
          onClick={onAsk(entry, 'reject')}
        >
          <X size={16} strokeWidth={1.75} aria-hidden />
          {t.reject}
        </Button>
        <Button
          className={styles.accept}
          aria-label={`${t.accept}: ${entry.title}`}
          onClick={onAsk(entry, 'accept')}
        >
          {t.accept}
        </Button>
      </div>
    )
  }
  const reopenable = entry.course !== null || entry.decision === 'rejected'
  if (!withBadge && !entry.emailFailed && !reopenable) return null
  return (
    <div className={styles.decisionButtons}>
      {withBadge ? <DecisionBadge entry={entry} ar={ar} /> : null}
      {entry.emailFailed ? (
        <Button
          variant="secondary"
          loading={resending}
          aria-label={`${t.resend}: ${entry.title}`}
          onClick={() => onResend(entry)}
        >
          {t.resend}
        </Button>
      ) : null}
      {reopenable ? (
        <Button
          variant="secondary"
          aria-label={`${t.reopen}: ${entry.title}`}
          onClick={onAsk(entry, 'reopen')}
        >
          {t.reopen}
        </Button>
      ) : null}
    </div>
  )
}

/**
 * A whole application in a wide dialog. The answers are the public form itself,
 * filled in and read-only, so the admin reads them as the applicant wrote them.
 * An admin decides each course here.
 */
export function ApplicantDetail({
  application: a,
  ar,
  admin,
  open,
  onOpenChange,
  onDecided,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onDecided: (course: number | null, decision: Decision, result: DecisionResult) => void
}) {
  const t = applicantsCopy(ar)
  const name = a.name || t.untitled
  const entries = entriesOf(a)
  const [ask, setAsk] = useState<{ entry: Entry; decision: Decision } | null>(null)
  const [resending, setResending] = useState<string | null>(null)
  const [error, setError] = useState('')
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const onAsk: Ask = (entry, decision) => (e) => {
    opener.current = e.currentTarget
    setAsk({ entry, decision })
  }
  const onResend = async (entry: Entry) => {
    setResending(entry.key)
    setError('')
    try {
      onDecided(entry.course, 'resend', await sendDecision(a.id, entry.course, 'resend', t.failed))
    } catch (e) {
      setError(e instanceof Error ? e.message : t.failed)
    } finally {
      setResending(null)
    }
  }
  const actions = (entry: Entry, withBadge: boolean) =>
    admin ? (
      <EntryActions
        entry={entry}
        ar={ar}
        onAsk={onAsk}
        onResend={onResend}
        resending={resending === entry.key}
        withBadge={withBadge}
      />
    ) : null
  const single = entries.length === 1
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        bare
        className={`arc-scope ${styles.detail}`}
        dir={ar ? 'rtl' : 'ltr'}
        title={name}
        description={a.email}
        closeLabel={t.close}
      >
        <CourseTiles application={a} ar={ar} />
        <div className={styles.review}>
          <header className={styles.heading}>
            <h2 ref={heading} tabIndex={-1}>
              {name}
            </h2>
            <EmailLine email={a.email} />
          </header>
          {error ? <Alert tone="danger" title={error} /> : null}
          {single ? actions(entries[0]!, false) : null}
          {admin && !single ? (
            <ul className={styles.courseList} aria-label={t.course}>
              {entries.map((e) => (
                <li key={e.key}>
                  <CourseTile entry={e} ar={ar} className={styles.courseRow}>
                    {actions(e, true)}
                  </CourseTile>
                </li>
              ))}
            </ul>
          ) : null}
          <PayloadForm
            form={{ id: a.formId, fields: a.fields }}
            lang={ar ? 'ar' : 'en'}
            application={
              a.choices.length
                ? {
                    selectable: true,
                    courses: a.choices.map((c) => ({
                      id: c.course,
                      title: c.title,
                      cover: c.cover,
                      questions: c.fields ?? [],
                      contribution: c.contribution,
                    })),
                  }
                : undefined
            }
            review={{
              answers: a.answers,
              choices: a.choices.map((c) => ({
                course: c.course,
                amount: 'amount' in c ? c.amount : null,
                need_reduction: 'need_reduction' in c ? c.need_reduction : null,
                answers: c.answers,
              })),
            }}
          />
        </div>
        {admin && (
          <DecisionDialog
            application={a}
            ask={ask}
            ar={ar}
            onClose={() => setAsk(null)}
            decide={(entry, decision) => sendDecision(a.id, entry.course, decision, t.failed)}
            onDone={(entry, decision, result) => {
              setAsk(null)
              onDecided(entry.course, decision, result)
            }}
            returnFocus={() => {
              // A decided row swaps its buttons: fall back to the name.
              const button = opener.current
              return button?.isConnected ? button : heading.current
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
