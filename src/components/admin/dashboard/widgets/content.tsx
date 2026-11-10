import { Cog } from 'lucide-react'
import Link from 'next/link'
import type { Payload } from 'payload'

import { ROLE_OPTIONS } from '@/access'
import { Avatar } from '@/components/arc/avatar/avatar'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import { MetricCard } from '@/components/arc/metric-card/metric-card'
import { Timeline } from '@/components/arc/timeline/timeline'
import { CAIRO } from '@/lib/cairo-day'
import { eventTiming } from '@/lib/events'
import { mediaPopulate, mediaThumbnail } from '@/lib/media-image'
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

type Editor = { id: number; name: string; email: string; roles: string; photo: string | null }
type Change = {
  id: string
  title: string
  /** The admin page that edits it. */
  href: string
  collection: string
  status: 'draft' | 'published' | null
  cover: string | null
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
    select: { email: true, person: true, roles: true },
    // The storage hook builds `url` from `filename` and `prefix`; without them it is null.
    populate: { people: { name: true, photo: true }, media: { ...mediaPopulate, sizes: true } },
    pagination: false,
    depth: 2,
    overrideAccess: true,
  })
  return new Map(
    docs.map((user) => {
      const person = typeof user.person === 'object' ? user.person : null
      const photo =
        typeof person?.photo === 'object' ? (mediaThumbnail(person.photo) ?? null) : null
      const roles = (user.roles ?? [])
        .map((role) => ROLE_OPTIONS.find((option) => option.value === role)?.label ?? role)
        .join(', ')
      const name = person?.name || user.email.split('@')[0]
      return [user.id, { id: user.id, name, email: user.email, roles, photo }]
    }),
  )
}

const recent = () =>
  cachedStat<Change[]>('recent-changes-v4', async (payload) => {
    const lists = await Promise.all(
      PIPELINE.map(async ({ slug, label }) => {
        const { docs } = await payload.find({
          collection: slug,
          select: {
            title: true,
            updatedAt: true,
            last_edited_by: true,
            cover_image: true,
            _status: true,
          },
          populate: { media: { ...mediaPopulate, sizes: true } },
          sort: '-updatedAt',
          limit: 8,
          depth: 1,
          overrideAccess: true,
        })
        return docs.map((doc) => ({
          id: `${slug}-${doc.id}`,
          title: doc.title,
          href: `/admin/collections/${slug}/${doc.id}`,
          collection: label,
          status: doc._status ?? null,
          cover:
            typeof doc.cover_image === 'object' ? (mediaThumbnail(doc.cover_image) ?? null) : null,
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

/** The hover preview of an edited item: its cover, kind and state, and title. */
function ChangeCard({ change }: { change: Change }) {
  const state =
    change.status === 'published' ? 'Published' : change.status === 'draft' ? 'Draft' : null
  return (
    <div className={styles.preview}>
      {change.cover && (
        // eslint-disable-next-line @next/next/no-img-element -- an R2 thumbnail in the admin
        <img className={styles.previewCover} src={change.cover} alt="" decoding="async" />
      )}
      <p className={styles.previewKind}>{[change.collection, state].filter(Boolean).join(' · ')}</p>
      <p className={styles.previewTitle} dir="auto">
        {change.title}
      </p>
    </div>
  )
}

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
          cardClassName="arc-scope"
          events={changes.map((change) => ({
            id: change.id,
            at: change.at,
            actor: change.by?.name ?? 'System',
            actorHref: change.by ? `/admin/collections/users/${change.by.id}` : undefined,
            actorCard: change.by ? (
              <HoverCardProfile
                name={change.by.name}
                role={change.by.roles || undefined}
                avatar={change.by.photo ?? undefined}
                meta={change.by.email}
              />
            ) : undefined,
            title: 'edited',
            subject: change.title,
            subjectHref: change.href,
            subjectCard: <ChangeCard change={change} />,
            meta: change.collection,
            icon: change.by ? (
              <Avatar name={change.by.name} src={change.by.photo ?? undefined} size="sm" />
            ) : (
              <Cog size={14} aria-hidden />
            ),
          }))}
        />
      )}
    </WidgetCard>
  )
}
