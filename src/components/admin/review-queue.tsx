import { DefaultTemplate } from '@payloadcms/next/templates'
import { Gutter } from '@payloadcms/ui'
import Link from 'next/link'
import type { AdminViewServerProps, Payload, TypedUser } from 'payload'

import { isAdminUser } from '@/access'
import { getReviewQueue, type QueueItem, type QueueKind } from '@/lib/review-queue'

const KINDS: Record<QueueKind, string> = {
  article: 'Article',
  course: 'Course',
  publication: 'Publication',
}

const box = { padding: '16px 20px' } as const
const muted = { color: 'var(--theme-elevation-500)' } as const
const cell = {
  padding: '10px 12px',
  borderBottom: '1px solid var(--theme-elevation-100)',
  textAlign: 'start',
} as const

/** "3 days ago", from an ISO date. */
const waited = (since: string) => {
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000)
  if (days < 1) return 'today'
  return days === 1 ? '1 day ago' : `${days} days ago`
}

function QueueTable({ items }: { items: QueueItem[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={muted}>
          <th style={cell}>What</th>
          <th style={cell}>Title</th>
          <th style={cell}>From</th>
          <th style={cell}>Sent</th>
          <th style={cell} />
        </tr>
      </thead>
      <tbody>
        {items.map((i) => (
          <tr key={`${i.kind}-${i.id}`}>
            <td style={cell}>{KINDS[i.kind]}</td>
            <td style={cell} dir="auto">
              {i.title}
            </td>
            <td style={cell} dir="auto">
              {i.by || '—'}
            </td>
            <td style={cell}>{waited(i.since)}</td>
            <td style={cell}>
              <Link href={i.href} style={{ fontWeight: 600 }}>
                Open
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/**
 * The dashboard's first box, for admins: what waits for them, the oldest
 * first, and a way to the full list (Admin → Reviews).
 */
export async function ReviewQueueWidget({
  payload,
  user,
}: {
  payload: Payload
  user?: TypedUser | null
}) {
  if (!isAdminUser(user)) return null
  const items = await getReviewQueue(payload)
  return (
    <section
      aria-labelledby="review-queue-title"
      className="cilas-admin-box"
      style={{ ...box, margin: '0 0 24px' }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: '12px',
        }}
      >
        <h2 id="review-queue-title" style={{ margin: 0, fontSize: '18px' }}>
          Waiting for review {items.length ? `(${items.length})` : ''}
        </h2>
        <Link href="/admin/reviews">All of it →</Link>
      </div>
      {items.length ? (
        <QueueTable items={items.slice(0, 5)} />
      ) : (
        <p style={{ ...muted, margin: '8px 0 0' }}>Nothing waits for you.</p>
      )}
    </section>
  )
}

/** Admin → Reviews: every article, course and publication submitted for review. */
export async function ReviewQueueView({
  initPageResult,
  params,
  searchParams,
  user,
}: AdminViewServerProps) {
  const payload = initPageResult.req.payload
  const items = isAdminUser(user) ? await getReviewQueue(payload) : []
  return (
    <DefaultTemplate
      i18n={initPageResult.req.i18n}
      locale={initPageResult.locale}
      params={params}
      payload={payload}
      permissions={initPageResult.permissions}
      searchParams={searchParams}
      user={user}
      visibleEntities={initPageResult.visibleEntities}
    >
      <Gutter>
        <h1 style={{ margin: '24px 0 8px' }}>Waiting for review</h1>
        {/* Custom views are not protected by Payload's access rules. */}
        {!isAdminUser(user) ? (
          <p>Only admins review submissions.</p>
        ) : (
          <>
            <p style={{ ...muted, marginTop: 0 }}>
              Articles, courses and publications submitted for review. The oldest first.
              Applications are on the <Link href="/admin/applicants">Applicants</Link> page.
            </p>
            {items.length ? <QueueTable items={items} /> : <p>Nothing waits for you.</p>}
          </>
        )}
      </Gutter>
    </DefaultTemplate>
  )
}
