'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { X } from 'lucide-react'
import { useRef, useState, useTransition, type MouseEvent, type RefObject } from 'react'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import type { FilterField } from '@/components/arc/filter-toolbar/filter-toolbar'
import type { Applicant, ApplicantsData } from '@/forms/applicants'
import { ApplicantsFilter, applicantFilterKeys } from './applicants-filter'
import { applicantsCopy } from './applicants-copy'
import { ApplicantDetail } from './applicant-detail'
import { DecisionDialog, type Decision } from './applicant-decision-dialog'
import { CourseTiles, EmailLine, StatusBadge } from './applicant-parts'
import styles from './applicants.module.css'

function ApplicantCard({
  application: a,
  ar,
  admin,
  fallbackFocus,
  onStatusChange,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  fallbackFocus: RefObject<HTMLElement | null>
  onStatusChange: (id: number, status: Applicant['status'], emailFailed: boolean) => void
}) {
  const t = applicantsCopy(ar)
  const [decision, setDecision] = useState<Decision | null>(null)
  const [detail, setDetail] = useState(false)
  const opener = useRef<HTMLElement | null>(null)
  const name = a.name || t.untitled
  const ask = (next: Decision) => (e: MouseEvent<HTMLElement>) => {
    opener.current = e.currentTarget
    setDecision(next)
  }
  const decide = async (action: Decision): Promise<boolean> => {
    const response = await fetch(`/api/form-submissions/${a.id}/${action}`, {
      method: 'POST',
      credentials: 'same-origin',
    })
    const body = await response.json()
    if (!response.ok || body.ok !== true) throw new Error(body.error || t.failed)
    return action === 'accept' && body.emailed === false
  }
  return (
    <div className={styles.applicant}>
      <article className={styles.card}>
        <CourseTiles choices={a.choices} ar={ar} />
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>
            <StatusBadge application={a} ar={ar} />
            <button
              type="button"
              className={styles.open}
              aria-label={`${name}: ${a.choices.map((c) => c.title).join(', ')}`}
              onClick={() => setDetail(true)}
            >
              {name}
            </button>
          </h3>
          <p className={styles.cardDescription}>
            <EmailLine email={a.email} />
          </p>
          {admin && (
            <div className={styles.cardFooter}>
              <Button
                variant="danger"
                disabled={a.status !== 'new'}
                onClick={ask('reject')}
                className={styles.reject}
              >
                <X size={16} strokeWidth={1.75} aria-hidden />
                {t.reject}
              </Button>
              <Button
                className={styles.accept}
                disabled={a.status === 'accepted' || !a.canAccept}
                onClick={ask('accept')}
              >
                {a.status === 'accepted' ? t.statuses.accepted : t.accept}
              </Button>
            </div>
          )}
        </div>
      </article>
      <ApplicantDetail
        application={a}
        ar={ar}
        admin={admin}
        open={detail}
        onOpenChange={setDetail}
      />
      {admin && (
        <DecisionDialog
          application={a}
          decision={decision}
          ar={ar}
          onClose={() => setDecision(null)}
          decide={decide}
          onDone={(done, emailFailed) => {
            setDecision(null)
            onStatusChange(a.id, done === 'accept' ? 'accepted' : 'rejected', emailFailed)
          }}
          returnFocus={() => {
            // A decided card leaves its button disabled or unmounted (status filter): fall back to the list summary.
            const button = opener.current
            return button?.isConnected && !(button as HTMLButtonElement).disabled
              ? button
              : fallbackFocus.current
          }}
        />
      )}
      {admin && !a.canAccept && a.status !== 'accepted' && (
        <p className={styles.note}>
          {t.noApproved} <Link href={`/admin/collections/form-submissions/${a.id}`}>{t.edit}</Link>
        </p>
      )}
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
  const [decisions, setDecisions] = useState<Record<number, Pick<Applicant, 'status' | 'decided'>>>(
    {},
  )
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
      (!values.get('status') || (decisions[a.id]?.status ?? a.status) === values.get('status')) &&
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
                application={{ ...a, ...decisions[a.id] }}
                ar={ar}
                admin={admin}
                fallbackFocus={summary}
                onStatusChange={(id, status, emailFailed) => {
                  setDecisions((current) => ({
                    ...current,
                    [id]: { status, decided: new Date().toISOString() },
                  }))
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
