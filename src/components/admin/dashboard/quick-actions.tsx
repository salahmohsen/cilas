import { Bot, ClipboardCheck, Images, Inbox, Mail, Plus, type LucideIcon } from 'lucide-react'
import Link from 'next/link'
import type { TypedUser } from 'payload'

import { getReviewQueue } from '@/lib/review-queue'
import { accountContactCount } from '@/lib/resend-contacts'
import { env } from '@/env'
import { workViewsFor, type WorkViewKey } from '@/components/admin/work-views'

import { cachedStat } from './cached'
import { openApplicationCount } from './widgets/applications'
import styles from './dashboard.module.css'

/** Make something new. */
const CREATE = [
  { href: '/admin/collections/articles/create', label: 'New article' },
  { href: '/admin/collections/events/create', label: 'New event' },
  { href: '/admin/collections/courses/create', label: 'New course' },
] as const

/** Open a list or a guide. */
const GO_TO = [
  { href: '/admin/collections/media', label: 'Media library', Icon: Images },
  { href: '/admin/ai-access', label: 'Connect an AI assistant', Icon: Bot },
] as const

/** The count tile of each work view; which ones show comes from workViewsFor. */
const TILE: Record<WorkViewKey, { caption: string; Icon: LucideIcon; attention: boolean }> = {
  reviews: { caption: 'Reviews waiting', Icon: ClipboardCheck, attention: true },
  applicants: { caption: 'Applications waiting', Icon: Inbox, attention: true },
  subscribers: { caption: 'Newsletter subscribers', Icon: Mail, attention: false },
}

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

/**
 * The top row: counts of what waits (each one opens its view), then the
 * buttons that create something, then the links to a list or a guide. The
 * counts follow the same role rules as the top bar. Unread notifications have
 * no page of their own: the bell in the top bar is where they are.
 */
export async function QuickActions({ user, language }: { user: TypedUser; language?: string }) {
  const views = workViewsFor(user, language)
  const count: Record<WorkViewKey, () => Promise<number | null>> = {
    reviews: () => waiting().catch(() => null),
    applicants: () => openApplicationCount().catch(() => null),
    subscribers,
  }
  const counts = await Promise.all(views.map((view) => count[view.key]()))
  return (
    <div className={styles.actions}>
      {views.length > 0 && (
        <nav aria-label="Waiting work" className={styles.tiles}>
          {views.map(({ key, href }, i) => {
            const { caption, Icon, attention } = TILE[key]
            const n = counts[i]
            return (
              <Link
                key={key}
                href={href}
                className={styles.tile}
                data-attention={attention && n ? '' : undefined}
              >
                <Icon aria-hidden size={16} className={styles.tileIcon} />
                <span className={styles.tileCount}>{n ?? '–'}</span>
                <span className={styles.tileLabel}>{caption}</span>
              </Link>
            )
          })}
        </nav>
      )}
      <nav aria-label="Create" className={styles.links}>
        {CREATE.map(({ href, label }) => (
          <Link key={href} href={href} className={styles.pill}>
            <Plus aria-hidden size={16} />
            {label}
          </Link>
        ))}
      </nav>
      <nav aria-label="Shortcuts" className={styles.links}>
        {GO_TO.map(({ href, label, Icon }) => (
          <Link key={href} href={href} className={styles.pill} data-kind="go">
            <Icon aria-hidden size={16} />
            {label}
          </Link>
        ))}
      </nav>
    </div>
  )
}
