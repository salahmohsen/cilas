'use client'

import { useRef, useState, type MouseEvent } from 'react'
import { X } from 'lucide-react'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { PayloadForm } from '@/components/forms/payload-form'
import type { Applicant } from '@/forms/applicants'
import { sendDecision, type Decision, type DecisionResult } from './applicant-decide'
import { DecisionDialog } from './applicant-decision-dialog'
import { CourseTile, CourseTiles, DecisionBadge, EmailLine } from './applicant-parts'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

type Choice = Applicant['choices'][number]

/** Reject and Accept for one course. Both open the confirmation, so nothing is decided by one click. */
function DecisionButtons({
  choice,
  ar,
  onAsk,
}: {
  choice: Choice
  ar: boolean
  onAsk: (choice: Choice, decision: Decision) => (e: MouseEvent<HTMLElement>) => void
}) {
  const t = applicantsCopy(ar)
  return (
    <div className={styles.decisionButtons}>
      <Button
        variant="danger"
        className={styles.reject}
        aria-label={`${t.reject}: ${choice.title}`}
        onClick={onAsk(choice, 'reject')}
      >
        <X size={16} strokeWidth={1.75} aria-hidden />
        {t.reject}
      </Button>
      <Button
        className={styles.accept}
        aria-label={`${t.accept}: ${choice.title}`}
        onClick={onAsk(choice, 'accept')}
      >
        {t.accept}
      </Button>
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
  onDecided: (course: number, decision: Decision, result: DecisionResult) => void
}) {
  const t = applicantsCopy(ar)
  const name = a.name || t.untitled
  const [ask, setAsk] = useState<{ course: Choice; decision: Decision } | null>(null)
  const opener = useRef<HTMLElement | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const onAsk = (course: Choice, decision: Decision) => (e: MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget
    setAsk({ course, decision })
  }
  const single = a.choices.length === 1
  const pending = (c: Choice) => c.decision === 'pending'
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
        <CourseTiles choices={a.choices} ar={ar} />
        <div className={styles.review}>
          <header className={styles.heading}>
            <h2 ref={heading} tabIndex={-1}>
              {name}
            </h2>
            <EmailLine email={a.email} />
          </header>
          {admin && single && pending(a.choices[0]!) && (
            <DecisionButtons choice={a.choices[0]!} ar={ar} onAsk={onAsk} />
          )}
          {admin && !single && (
            <ul className={styles.courseList} aria-label={t.course}>
              {a.choices.map((c) => (
                <li key={c.course}>
                  <CourseTile choice={c} ar={ar} className={styles.courseRow}>
                    {pending(c) ? (
                      <DecisionButtons choice={c} ar={ar} onAsk={onAsk} />
                    ) : (
                      <DecisionBadge choice={c} ar={ar} />
                    )}
                  </CourseTile>
                </li>
              ))}
            </ul>
          )}
          <PayloadForm
            form={{ id: a.formId, fields: a.fields }}
            lang={ar ? 'ar' : 'en'}
            application={{
              selectable: true,
              courses: a.choices.map((c) => ({
                id: c.course,
                title: c.title,
                cover: c.cover,
                questions: c.fields ?? [],
                contribution: c.contribution,
              })),
            }}
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
            decide={(course, decision) => sendDecision(a.id, course, decision, t.failed)}
            onDone={(course, decision, result) => {
              setAsk(null)
              onDecided(course, decision, result)
            }}
            returnFocus={() => {
              // A decided row swaps its buttons for a badge: fall back to the name.
              const button = opener.current
              return button?.isConnected ? button : heading.current
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
