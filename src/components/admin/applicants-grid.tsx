'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition, type RefObject } from 'react'
import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Card } from '@/components/arc/card/card'
import { Dialog, DialogClose, DialogContent } from '@/components/arc/dialog/dialog'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import type { FilterField } from '@/components/arc/filter-toolbar/filter-toolbar'
import { PayloadAnswers } from '@/components/forms/payload-question'
import type { Applicant, ApplicantsData } from '@/forms/applicants'
import { focalPointStyle } from '@/lib/media-image'
import { formatAmount } from '@/lib/pricing'
import { ApplicantsFilter, applicantFilterKeys } from './applicants-filter'
import { applicantsCopy } from './applicants-copy'
import styles from './applicants.module.css'

function ApplicantCard({
  application: a,
  ar,
  admin,
  selectedCourse,
  fallbackFocus,
  onStatusChange,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  selectedCourse: string | null
  fallbackFocus: RefObject<HTMLElement | null>
  onStatusChange: (id: number, status: Applicant['status'], emailFailed: boolean) => void
}) {
  const t = applicantsCopy(ar)
  const status = a.status
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const choice = a.choices.find((c) => String(c.course) === selectedCourse) ?? a.choices[0]
  const cover = choice?.cover
  const name = a.name || t.untitled
  // The course leads: the chosen one (the filter's, else the first), then any others.
  const courses = [choice, ...a.choices.filter((c) => c !== choice)]
    .flatMap((c) => (c ? [c.title] : []))
    .join(ar ? '، ' : ', ')
  const run = async (action: 'accept' | 'reject') => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/form-submissions/${a.id}/${action}`, {
        method: 'POST',
        credentials: 'same-origin',
      })
      const body = await response.json()
      if (!response.ok || body.ok !== true) throw new Error(body.error || t.failed)
      if (action === 'reject') setConfirm(false)
      onStatusChange(
        a.id,
        action === 'accept' ? 'accepted' : 'rejected',
        action === 'accept' && body.emailed === false,
      )
    } catch (error) {
      setError(error instanceof Error ? error.message : t.failed)
      throw error
    } finally {
      running.current = false
      setBusy(false)
    }
  }
  const actions = admin ? (
    <div className={styles.actions}>
      <ActionButton
        label={status === 'accepted' ? t.statuses.accepted : t.accept}
        pendingLabel={t.accepting}
        successLabel={t.statuses.accepted}
        resetAfterMs={0}
        disabled={status === 'accepted' || !a.canAccept || (busy && confirm)}
        onAction={() => run('accept')}
      />
      <Button
        variant="secondary"
        disabled={status !== 'new' || busy}
        onClick={(e) => {
          opener.current = e.currentTarget
          setConfirm(true)
        }}
      >
        {status === 'rejected' ? t.statuses.rejected : t.reject}
      </Button>
    </div>
  ) : undefined
  const date = new Date(a.submitted).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
    timeZone: 'Africa/Cairo',
  })
  return (
    <div className={styles.applicant}>
      <Card
        title={courses}
        triggerLabel={`${name}: ${courses}`}
        description={name}
        meta={a.email}
        status={`${t.statuses[status]} · ${date}`}
        closeLabel={t.close}
        panelClassName={`arc-scope ${styles.quickLook}`}
        media={
          <span className={styles.cover}>
            {cover ? (
              <Image
                src={cover.url}
                alt={cover.alt}
                fill
                sizes="(max-width: 700px) 100vw, 480px"
                style={focalPointStyle(cover)}
              />
            ) : (
              t.noCover
            )}
          </span>
        }
        action={actions}
        details={
          <div className={styles.details}>
            <section className={styles.fields} aria-label={t.shared}>
              <h3>{t.shared}</h3>
              <PayloadAnswers fields={a.fields} answers={a.answers} />
            </section>
            {a.choices.map((c) => (
              <section key={c.course} className={styles.fields} aria-label={c.title}>
                <h3>{c.title}</h3>
                <p>
                  {t.approved}: {c.accepted ? t.yes : t.no}
                </p>
                <PayloadAnswers fields={c.fields} answers={c.answers} />
                {admin && (
                  <>
                    <p>
                      {t.amount}:{' '}
                      {c.amount == null ? t.no : formatAmount(c.amount, ar ? 'ar' : 'en')}
                    </p>
                    <p>
                      {t.reduction}: {c.need_reduction ? t.yes : t.no}
                    </p>
                  </>
                )}
              </section>
            ))}
            {admin && <Link href={`/admin/collections/form-submissions/${a.id}`}>{t.edit}</Link>}
          </div>
        }
      />
      {admin && (
        <Dialog
          open={confirm}
          onOpenChange={(open) => {
            if (!running.current) setConfirm(open)
          }}
        >
          <DialogContent
            className={`arc-scope ${styles.dialog}`}
            dir={ar ? 'rtl' : 'ltr'}
            title={t.rejectTitle}
            description={`${name}. ${t.rejectBody}`}
            closeLabel={t.close}
            onCloseAutoFocus={(e) => {
              // Reject has no DialogTrigger, so return focus here. A rejected card leaves its button
              // disabled or unmounted (status filter), so fall back to the list summary.
              e.preventDefault()
              const button = opener.current
              const target =
                button?.isConnected && !(button as HTMLButtonElement).disabled
                  ? button
                  : fallbackFocus.current
              target?.focus()
            }}
            onEscapeKeyDown={(e) => {
              if (busy) e.preventDefault()
            }}
            onPointerDownOutside={(e) => {
              if (busy) e.preventDefault()
            }}
          >
            {error && <Alert tone="danger" title={error} />}
            <div className={styles.actions}>
              <DialogClose asChild>
                <Button variant="secondary" disabled={busy}>
                  {t.cancel}
                </Button>
              </DialogClose>
              <ActionButton
                label={t.reject}
                pendingLabel={t.rejecting}
                successLabel={t.statuses.rejected}
                onAction={() => run('reject')}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
      {admin && !a.canAccept && status !== 'accepted' && (
        <p className={styles.note}>
          {t.noApproved} <Link href={`/admin/collections/form-submissions/${a.id}`}>{t.edit}</Link>
        </p>
      )}
      {error && !confirm && <Alert tone="danger" title={error} />}
    </div>
  )
}

/** The toolbar's chips carry option labels, so two options must never share one. Only a repeated label gets its id. */
const distinctLabels = <T extends { value: string; label: string }>(options: T[]) =>
  options.map((o) =>
    options.some((x) => x !== o && x.label === o.label)
      ? { ...o, label: `${o.label} (${o.value})` }
      : o,
  )

export function ApplicantsError({ ar }: { ar: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const t = applicantsCopy(ar)
  return (
    <Alert tone="danger" title={t.loadError}>
      <Button
        variant="secondary"
        loading={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        {t.retry}
      </Button>
    </Alert>
  )
}

export function ApplicantsGrid({
  data,
  ar,
  admin,
}: {
  data: ApplicantsData
  ar: boolean
  admin: boolean
}) {
  const t = applicantsCopy(ar)
  const search = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const values = new URLSearchParams(search.toString())
  const summary = useRef<HTMLParagraphElement>(null)
  const [emailWarnings, setEmailWarnings] = useState<number[]>([])
  const [decisions, setDecisions] = useState<Record<number, Applicant['status']>>({})
  const cycles = new Map(
    data.applications.flatMap((a) =>
      a.choices.flatMap((c) =>
        c.cycle ? [[String(c.cycle.id), c.cycle.title || String(c.cycle.id)] as const] : [],
      ),
    ),
  )
  const fields: FilterField[] = [
    {
      id: 'course',
      label: t.course,
      options: distinctLabels(
        data.courses.map((c) => ({ value: String(c.id), label: c.title, hint: c.count })),
      ),
    },
    {
      id: 'status',
      label: t.status,
      options: Object.entries(t.statuses).map(([value, label]) => ({ value, label })),
    },
    {
      id: 'cycle',
      label: t.cycle,
      options: distinctLabels([...cycles].map(([value, label]) => ({ value, label }))),
    },
    ...(admin
      ? [
          {
            id: 'reduction',
            label: t.reduction,
            options: [
              { value: 'yes', label: t.yes },
              { value: 'no', label: t.no },
            ],
          },
        ]
      : []),
  ]
  const change = (id?: string, value?: string) => {
    const next = new URLSearchParams(search.toString())
    if (!id) applicantFilterKeys.forEach((key) => next.delete(key))
    else if (value) next.set(id, value)
    else next.delete(id)
    startTransition(() => router.push(`${pathname}?${next}`, { scroll: false }))
  }
  const applications = data.applications.filter(
    (a) =>
      (!values.get('status') || (decisions[a.id] ?? a.status) === values.get('status')) &&
      a.choices.some(
        (c) =>
          (!values.get('course') || String(c.course) === values.get('course')) &&
          (!values.get('cycle') || String(c.cycle?.id) === values.get('cycle')) &&
          (!admin ||
            !values.get('reduction') ||
            Boolean(c.need_reduction) === (values.get('reduction') === 'yes')),
      ),
  )
  return (
    <div className={styles.body} aria-busy={pending}>
      {emailWarnings.map((id) => (
        <Alert key={id} tone="warning" title={t.emailFailed}>
          {data.applications.find((a) => a.id === id)?.name}
        </Alert>
      ))}
      <ApplicantsFilter fields={fields} values={values} onChange={change} ar={ar} />
      <p role="status" tabIndex={-1} ref={summary} className={styles.count}>
        {pending ? t.loading : t.showing(applications.length, data.applications.length)}
      </p>
      {applications.length ? (
        <>
          <h2 className={styles.srOnly}>{t.list}</h2>
          <div className={styles.grid}>
            {applications.map((a) => (
              <ApplicantCard
                key={a.id}
                application={{ ...a, status: decisions[a.id] ?? a.status }}
                ar={ar}
                admin={admin}
                selectedCourse={values.get('course')}
                fallbackFocus={summary}
                onStatusChange={(id, status, emailFailed) => {
                  setDecisions((current) => ({ ...current, [id]: status }))
                  if (emailFailed)
                    setEmailWarnings((current) => [...current.filter((value) => value !== id), id])
                }}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState
          title={data.applications.length ? t.noMatches : t.empty}
          description={data.applications.length ? t.noMatchesBody : t.emptyBody}
          action={
            fields.some((f) => values.has(f.id)) ? (
              <Button variant="secondary" onClick={() => change()}>
                {t.clear}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  )
}
