'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { ActionButton } from '@/components/arc/action-button/action-button'
import { Alert } from '@/components/arc/alert/alert'
import { Badge } from '@/components/arc/badge/badge'
import { Button } from '@/components/arc/button/button'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/arc/dialog/dialog'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { ExpandableCard } from '@/components/arc/expandable-card/expandable-card'
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
  onStatusChange,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  selectedCourse: string | null
  onStatusChange: (id: number, status: Applicant['status'], emailFailed: boolean) => void
}) {
  const t = applicantsCopy(ar)
  const status = a.status
  const [busy, setBusy] = useState(false)
  const running = useRef(false)
  const [error, setError] = useState('')
  const [confirm, setConfirm] = useState(false)
  const choice = a.choices.find((c) => String(c.course) === selectedCourse) ?? a.choices[0]
  const cover = choice?.cover
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
  return (
    <article className={styles.applicant}>
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
          <span>{t.noCover}</span>
        )}
      </span>
      <ExpandableCard title={a.name || t.untitled} description={a.email}>
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
                    {t.amount}: {c.amount == null ? t.no : formatAmount(c.amount, ar ? 'ar' : 'en')}
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
      </ExpandableCard>
      <div className={styles.summary}>
        <div className={styles.meta}>
          <Badge
            tone={status === 'accepted' ? 'success' : status === 'rejected' ? 'danger' : 'neutral'}
          >
            {t.statuses[status]}
          </Badge>
          <time dateTime={a.submitted}>
            {new Date(a.submitted).toLocaleDateString(ar ? 'ar-EG' : 'en-GB', {
              timeZone: 'Africa/Cairo',
            })}
          </time>
        </div>
        <p>{a.choices.map((c) => c.title).join(ar ? '، ' : ', ')}</p>
        {admin && (
          <div className={styles.actions}>
            <ActionButton
              label={status === 'accepted' ? t.statuses.accepted : t.accept}
              pendingLabel={t.accepting}
              successLabel={t.statuses.accepted}
              resetAfterMs={0}
              disabled={status === 'accepted' || !a.canAccept || (busy && confirm)}
              onAction={() => run('accept')}
            />
            <Dialog
              open={confirm}
              onOpenChange={(open) => {
                if (!running.current) setConfirm(open)
              }}
            >
              <DialogTrigger asChild>
                <Button variant="secondary" disabled={status !== 'new' || busy}>
                  {status === 'rejected' ? t.statuses.rejected : t.reject}
                </Button>
              </DialogTrigger>
              <DialogContent
                className={`arc-scope ${styles.dialog}`}
                dir={ar ? 'rtl' : 'ltr'}
                title={t.rejectTitle}
                description={`${a.name || t.untitled}. ${t.rejectBody}`}
                closeLabel={t.close}
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
          </div>
        )}
        {admin && !a.canAccept && status !== 'accepted' && (
          <p>
            {t.noApproved}{' '}
            <Link href={`/admin/collections/form-submissions/${a.id}`}>{t.edit}</Link>
          </p>
        )}
        {error && !confirm && <Alert tone="danger" title={error} />}
        <span role="status" className={styles.srOnly}>
          {t.statuses[status]}
        </span>
      </div>
    </article>
  )
}

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
      options: data.courses.map((c) => ({
        value: String(c.id),
        label: `${c.title} (${c.id})`,
        hint: c.count,
      })),
    },
    {
      id: 'status',
      label: t.status,
      options: Object.entries(t.statuses).map(([value, label]) => ({ value, label })),
    },
    {
      id: 'cycle',
      label: t.cycle,
      options: [...cycles].map(([value, label]) => ({ value, label: `${label} (${value})` })),
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
      <p role="status" className={styles.count}>
        {pending ? t.loading : `${applications.length} / ${data.applications.length}`}
      </p>
      {applications.length ? (
        <div className={styles.grid}>
          {applications.map((a) => (
            <ApplicantCard
              key={a.id}
              application={{ ...a, status: decisions[a.id] ?? a.status }}
              ar={ar}
              admin={admin}
              selectedCourse={values.get('course')}
              onStatusChange={(id, status, emailFailed) => {
                setDecisions((current) => ({ ...current, [id]: status }))
                if (emailFailed)
                  setEmailWarnings((current) => [...current.filter((value) => value !== id), id])
              }}
            />
          ))}
        </div>
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
