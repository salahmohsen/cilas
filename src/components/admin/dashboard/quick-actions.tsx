import Link from 'next/link'
import type { Payload, TypedUser } from 'payload'

import { getReviewQueue } from '@/lib/review-queue'
import { accountContactCount } from '@/lib/resend-contacts'
import { env } from '@/env'

import { cachedStat } from './cached'
import styles from './dashboard.module.css'

const CREATE = [
  { href: '/admin/collections/articles/create', label: 'New article' },
  { href: '/admin/collections/events/create', label: 'New event' },
  { href: '/admin/collections/courses/create', label: 'New course' },
  { href: '/admin/collections/media', label: 'Media library' },
  { href: '/admin/ai-access', label: 'Connect an AI assistant' },
] as const

type Tile = { label: string; count: number | null; href?: string }

/** What waits in the review queue: shared by every admin, so it is cached. */
const waiting = () =>
  cachedStat('review-count', async (payload) => (await getReviewQueue(payload)).length)

/** Contacts in the Resend account; null when Resend is not set up or does not answer. */
const subscribers = () =>
  cachedStat<number | null>(
    'subscribers',
    async () => (env.RESEND_API_KEY ? accountContactCount() : null),
    600,
  ).catch(() => null)

/** Unread bell notifications of the signed-in admin; private to them, so never cached. */
const unread = (payload: Payload, user: TypedUser) =>
  payload
    .count({
      collection: 'notifications',
      where: { and: [{ recipient: { equals: user.id } }, { read_at: { exists: false } }] },
      overrideAccess: false,
      user,
    })
    .then((r) => r.totalDocs)
    .catch(() => null)

/** The top row: where admins act first, with live counts, then the create links. */
export async function QuickActions({ payload, user }: { payload: Payload; user: TypedUser }) {
  const [review, contacts, notifications] = await Promise.all([
    waiting().catch(() => null),
    subscribers(),
    unread(payload, user),
  ])
  const tiles: Tile[] = [
    { label: 'Reviews and applications waiting', count: review, href: '/admin/reviews' },
    { label: 'Newsletter subscribers', count: contacts, href: '/admin/subscribers' },
    { label: 'Unread notifications', count: notifications },
  ]
  return (
    <div className={styles.actions}>
      {tiles.map(({ label, count, href }) => {
        const body = (
          <>
            <span className={styles.tileCount}>{count ?? '–'}</span>
            <span className={styles.tileLabel}>{label}</span>
          </>
        )
        return href ? (
          <Link key={label} href={href} className={styles.tile}>
            {body}
          </Link>
        ) : (
          <div key={label} className={styles.tile}>
            {body}
          </div>
        )
      })}
      <nav aria-label="Shortcuts" className={styles.create}>
        {CREATE.map(({ href, label }) => (
          <Link key={href} href={href} className={styles.pill}>
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
