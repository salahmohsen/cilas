import { Cog } from 'lucide-react'
import Link from 'next/link'
import type { Payload } from 'payload'

import { Avatar } from '@/components/arc/avatar/avatar'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { Timeline } from '@/components/arc/timeline/timeline'
import { CAIRO } from '@/lib/cairo-day'
import { eventTiming } from '@/lib/events'
import type { Event } from '@/payload-types'

import { cachedStat } from '../cached'
import styles from '../dashboard.module.css'
import { formatDay, plural } from '../format'
import { WidgetCard } from '../widget-card'

const PIPELINE = [
  { slug: 'articles', label: 'Articles' },
  { slug: 'courses', label: 'Courses' },
  { slug: 'events', label: 'Events' },
  { slug: 'publications', label: 'Publications' },
] as const

type Pipeline = { slug: string; label: string; published: number; draft: number }[]

const pipeline = () =>
  cachedStat<Pipeline>('content-pipeline', (payload) =>
    Promise.all(
      PIPELINE.map(async ({ slug, label }) => {
        const count = (status: 'published' | 'draft') =>
          payload
            .count({
              collection: slug,
              where: { _status: { equals: status } },
              overrideAccess: true,
            })
            .then((r) => r.totalDocs)
        const [published, draft] = await Promise.all([count('published'), count('draft')])
        return { slug, label, published, draft }
      }),
    ),
  )

export async function PublishedCourses() {
  const courses = (await pipeline()).find((row) => row.slug === 'courses')
  return (
    <MetricCard
      label="Published courses"
      value={courses?.published ?? 0}
      context={plural(courses?.draft ?? 0, 'draft')}
    />
  )
}

type PublishedEvent = Pick<Event, 'id' | 'title' | 'schedule' | 'agenda'>

const publishedEvents = () =>
  cachedStat<PublishedEvent[]>('events-published', async (payload) => {
    const { docs } = await payload.find({
      collection: 'events',
      where: { _status: { equals: 'published' } },
      select: { title: true, schedule: true, agenda: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return docs
  })

/** Published events that have not ended yet, soonest first. */
const upcoming = async () => {
  const now = new Date()
  return (await publishedEvents())
    .flatMap((event) => {
      const { status, day, meeting } = eventTiming(event, now)
      return status === 'upcoming' && day
        ? [{ event, day, sortKey: `${day}T${meeting?.start_time ?? '00:00'}` }]
        : []
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
}

export async function UpcomingEventsCount() {
  const next = await upcoming()
  return (
    <MetricCard
      label="Upcoming events"
      value={next.length}
      context={next[0] ? `next one on ${formatDay(next[0].day)}` : 'none planned'}
    />
  )
}

export async function ContentPipeline() {
  const rows = await pipeline()
  return (
    <WidgetCard title="Content pipeline">
      <ul className={styles.list}>
        {rows.map(({ slug, label, published, draft }) => (
          <li key={slug} className={styles.row}>
            <Link href={`/admin/collections/${slug}`} className={styles.rowMain}>
              {label}
            </Link>
            <span className={styles.rowMeta}>
              {published} published, {plural(draft, 'draft')}
            </span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  )
}

export async function UpcomingEvents() {
  const next = (await upcoming()).slice(0, 5)
  return (
    <WidgetCard title="Upcoming events">
      {next.length === 0 ? (
        <EmptyState
          title="Nothing planned"
          description="Published events with a future date appear here."
        />
      ) : (
        <ul className={styles.list}>
          {next.map(({ event, day }) => (
            <li key={event.id} className={styles.row}>
              <Link href={`/admin/collections/events/${event.id}`} className={styles.rowMain}>
                {event.title}
              </Link>
              <span className={styles.rowMeta}>{formatDay(day)}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}

type Editor = { id: number; name: string; photo: string | null }
type Change = {
  id: string
  title: string
  collection: string
  at: string
  /** Who saved it last; null for a save before the editor was recorded. */
  by: Editor | null
}

/** Names and portraits for account ids: the person behind the account, else the email's first part. */
const editorsOf = async (payload: Payload, ids: number[]): Promise<Map<number, Editor>> => {
  if (!ids.length) return new Map()
  const { docs } = await payload.find({
    collection: 'users',
    where: { id: { in: ids } },
    select: { email: true, person: true },
    populate: { people: { name: true, photo: true }, media: { url: true } },
    pagination: false,
    depth: 2,
    overrideAccess: true,
  })
  return new Map(
    docs.map((user) => {
      const person = typeof user.person === 'object' ? user.person : null
      const photo = typeof person?.photo === 'object' ? (person.photo?.url ?? null) : null
      return [user.id, { id: user.id, name: person?.name || user.email.split('@')[0], photo }]
    }),
  )
}

const recent = () =>
  cachedStat<Change[]>('recent-changes-v2', async (payload) => {
    const lists = await Promise.all(
      PIPELINE.map(async ({ slug, label }) => {
        const { docs } = await payload.find({
          collection: slug,
          select: { title: true, updatedAt: true, last_edited_by: true },
          sort: '-updatedAt',
          limit: 8,
          depth: 0,
          overrideAccess: true,
        })
        return docs.map((doc) => ({
          id: `${slug}-${doc.id}`,
          title: doc.title,
          collection: label,
          at: doc.updatedAt,
          editorId: typeof doc.last_edited_by === 'number' ? doc.last_edited_by : null,
        }))
      }),
    )
    const latest = lists
      .flat()
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 8)
    const editors = await editorsOf(payload, [
      ...new Set(latest.flatMap((c) => (c.editorId === null ? [] : [c.editorId]))),
    ])
    return latest.map(({ editorId, ...change }) => ({
      ...change,
      by: editorId === null ? null : (editors.get(editorId) ?? null),
    }))
  })

export async function RecentChanges() {
  const changes = await recent()
  return (
    <WidgetCard title="Recent changes">
      {changes.length === 0 ? (
        <EmptyState
          title="No changes yet"
          description="Edited articles, courses, events and publications appear here."
        />
      ) : (
        <Timeline
          label="Recent changes"
          now={Date.now()}
          timeZone={CAIRO}
          maxHeight={360}
          events={changes.map(({ id, title, collection, at, by }) => ({
            id,
            at,
            actor: by?.name ?? 'System',
            actorHref: by ? `/admin/collections/users/${by.id}` : undefined,
            title: `edited ${title}`,
            meta: collection,
            icon: by ? (
              <Avatar name={by.name} src={by.photo ?? undefined} size="sm" />
            ) : (
              <Cog size={14} aria-hidden />
            ),
          }))}
        />
      )}
    </WidgetCard>
  )
}
