'use client'

import Link from 'next/link'
import { Dialog, DialogContent } from '@/components/arc/dialog/dialog'
import { PayloadForm } from '@/components/forms/payload-form'
import type { Applicant } from '@/forms/applicants'
import { applicantsCopy } from './applicants-copy'
import { CourseTiles, EmailLine, StatusBadge } from './applicant-parts'
import styles from './applicants.module.css'

/**
 * A whole application in a wide dialog. The answers are the public form itself,
 * filled in and read-only, so the admin reads them as the applicant wrote them.
 */
export function ApplicantDetail({
  application: a,
  ar,
  admin,
  open,
  onOpenChange,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = applicantsCopy(ar)
  const name = a.name || t.untitled
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
            <StatusBadge application={a} ar={ar} withDate />
            <h2>{name}</h2>
            <EmailLine email={a.email} />
          </header>
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
          {admin && (
            <footer className={styles.approval}>
              <h3>{t.approvedTitle}</h3>
              <ul>
                {a.choices.map((c) => (
                  <li key={c.course}>
                    {c.title}: {c.accepted ? t.yes : t.no}
                  </li>
                ))}
              </ul>
              <Link href={`/admin/collections/form-submissions/${a.id}`}>{t.edit}</Link>
            </footer>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
