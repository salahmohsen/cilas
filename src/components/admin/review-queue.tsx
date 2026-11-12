import Link from 'next/link'
import type { AdminViewServerProps, Payload, TypedUser } from 'payload'

import { isAdminUser } from '@/access'
import { getReviewQueue, type QueueItem } from '@/lib/review-queue'

import { adminLanguage, ArcAdminView } from './arc-admin-view'
import { reviewsCopy } from './reviews-copy'
import { ReviewsTable, type ReviewRow } from './reviews-table'
import styles from './reviews.module.css'

/** The queue as table rows, in the reader's language, timed from this request. */
const rowsOf = (items: QueueItem[], ar: boolean): ReviewRow[] => {
  const t = reviewsCopy(ar)
  const now = Date.now()
  return items.map((i) => ({
    key: `${i.kind}-${i.id}`,
    kind: t.kinds[i.kind],
    title: i.title ?? t.untitled,
    removal: i.removal,
    by: i.by || t.nobody,
    since: i.since,
    waited: t.waited(i.since, now),
    href: i.href,
  }))
}

/**
 * The dashboard box, for admins: the oldest five items and a way to the full
 * list. It sits inside the dashboard's own Arc scope.
 */
export async function ReviewQueueWidget({
  payload,
  user,
  ar,
}: {
  payload: Payload
  user?: TypedUser | null
  ar: boolean
}) {
  if (!isAdminUser(user)) return null
  const t = reviewsCopy(ar)
  const items = await getReviewQueue(payload)
  return (
    <section
      aria-labelledby="review-queue-title"
      className={styles.widget}
      dir={ar ? 'rtl' : 'ltr'}
    >
      <div className={styles.widgetHead}>
        <h2 id="review-queue-title">
          {t.title} {items.length ? `(${items.length})` : ''}
        </h2>
        <Link href="/admin/reviews">{t.all}</Link>
      </div>
      <ReviewsTable rows={rowsOf(items.slice(0, 5), ar)} ar={ar} />
    </section>
  )
}

async function Queue({ payload, ar }: { payload: Payload; ar: boolean }) {
  return <ReviewsTable rows={rowsOf(await getReviewQueue(payload), ar)} ar={ar} />
}

/** Admin → Reviews: every article, course and publication submitted for review. */
export function ReviewQueueView(view: AdminViewServerProps) {
  const req = view.initPageResult.req
  const language = adminLanguage(req)
  const ar = language === 'ar'
  const t = reviewsCopy(ar)
  return (
    <ArcAdminView view={view} language={language} title={t.title} allowed={isAdminUser(view.user)}>
      <p className={styles.intro}>
        {t.intro} {t.applicantsNote} <Link href="/admin/applicants">{t.applicantsLink}</Link>.
      </p>
      <Queue payload={req.payload} ar={ar} />
    </ArcAdminView>
  )
}
