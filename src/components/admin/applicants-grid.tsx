'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import type { FilterField } from '@/components/arc/filter-toolbar/filter-toolbar'
import type { Applicant, ApplicantsData } from '@/forms/applicants'
import { ApplicantsFilter, applicantFilterKeys } from './applicants-filter'
import { applicantsCopy } from './applicants-copy'
import { ApplicantDetail } from './applicant-detail'
import { withDecision } from './applicant-decide'
import { CourseTiles, EmailLine } from './applicant-parts'
import styles from './applicants.module.css'

function ApplicantCard({
  application: a,
  ar,
  admin,
  onDecided,
}: {
  application: Applicant
  ar: boolean
  admin: boolean
  onDecided: (application: Applicant, emailFailed: boolean) => void
}) {
  const t = applicantsCopy(ar)
  const search = useSearchParams()
  // A link from the review queue or a notification opens its application.
  const [detail, setDetail] = useState(search.get('application') === String(a.id))
  const name = a.name || t.untitled
  return (
    <div className={styles.applicant}>
      <article className={styles.card}>
        <CourseTiles application={a} ar={ar} />
        <div className={styles.cardBody}>
          <h3 className={styles.cardTitle}>
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
          <div className={styles.cardFooter}>
            <Button className={styles.accept} onClick={() => setDetail(true)}>
              {t.review}
            </Button>
          </div>
        </div>
      </article>
      <ApplicantDetail
        application={a}
        ar={ar}
        admin={admin}
        open={detail}
        onOpenChange={setDetail}
        onDecided={(course, decision, result) =>
          onDecided(withDecision(a, course, decision, result), result.emailFailed)
        }
      />
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
  const [emailWarnings, setEmailWarnings] = useState<number[]>([])
  // Applications decided on this page, as the server now has them.
  const [decided, setDecided] = useState<Record<number, Applicant>>({})
  // Fresh data from the server replaces what this page changed.
  const [seen, setSeen] = useState(data)
  if (seen !== data) {
    setSeen(data)
    setDecided({})
  }
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
  const wanted = values.get('status')
  const applications = data.applications.filter((a) => {
    const app = decided[a.id] ?? a
    // A programme application has no courses: only the status filter can match it.
    if (app.programme)
      return (
        !values.get('course') &&
        !values.get('cycle') &&
        !values.get('reduction') &&
        (!wanted || app.status === wanted)
      )
    return app.choices.some(
      (c) =>
        (!values.get('course') || String(c.course) === values.get('course')) &&
        (!values.get('cycle') || String(c.cycle?.id) === values.get('cycle')) &&
        (!admin ||
          !values.get('reduction') ||
          Boolean(c.need_reduction) === (values.get('reduction') === 'yes')) &&
        // With a course chosen, the status is that course's; else the application's.
        (!wanted ||
          (values.get('course')
            ? c.decision === (wanted === 'new' ? 'pending' : wanted)
            : app.status === wanted)),
    )
  })
  return (
    <div className={styles.body} aria-busy={pending}>
      {emailWarnings.map((id) => (
        <Alert key={id} tone="warning" title={t.emailFailed}>
          {data.applications.find((a) => a.id === id)?.name}
        </Alert>
      ))}
      <ApplicantsFilter fields={fields} values={values} onChange={change} ar={ar} />
      <p role="status" className={styles.count}>
        {pending ? t.loading : t.showing(applications.length, data.applications.length)}
      </p>
      {applications.length ? (
        <>
          <h2 className={styles.srOnly}>{t.list}</h2>
          <div className={styles.grid}>
            {applications.map((a) => (
              <ApplicantCard
                key={a.id}
                application={decided[a.id] ?? a}
                ar={ar}
                admin={admin}
                onDecided={(next, emailFailed) => {
                  setDecided((current) => ({ ...current, [a.id]: next }))
                  if (emailFailed)
                    setEmailWarnings((current) => [...current.filter((id) => id !== a.id), a.id])
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
