import { getTranslations } from 'next-intl/server'

import { Accordion } from '@/components/arc/accordion/accordion'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { eventTitle } from '@/lib/space-event'
import type { SpaceEventItem } from '@/lib/spaces-data'

import { EventCard } from './event-card'
import { PublicEvent, PublicEventBadge } from './public-event'
import type { FeedContext } from './feed-row'
import styles from './space.module.css'

/**
 * The Events tab. Each row is one kind of event, the space's own posts or the
 * course's public events, which have no page here to link to.
 */
async function EventRow({
  item,
  context,
  href,
}: {
  item: SpaceEventItem
  context: FeedContext
  href: string
}) {
  const t = await getTranslations('SpacePost')
  switch (item.type) {
    case 'post':
      return (
        <li className={styles.eventRow}>
          <h3 className={styles.eventRowTitle}>
            <a href={href} dir="auto" className={styles.eventRowLink}>
              {eventTitle(item.post.body, t('eventLabel'))}
            </a>
            {item.authorName && (
              <span className={styles.meta}>{t('eventBy', { name: item.authorName })}</span>
            )}
          </h3>
          <EventCard post={item.post} rsvp={item.rsvp} context={context} href={href} />
        </li>
      )
    case 'public':
      return (
        <li className={styles.eventRow}>
          <h3 className={styles.eventRowTitle}>
            <span dir="auto" className={styles.eventRowLink}>
              {item.title}
            </span>
            <PublicEventBadge />
          </h3>
          <PublicEvent item={item} />
        </li>
      )
  }
}

/** Upcoming events first, soonest first, then a collapsed group of the ones that are over. */
export async function EventList({
  upcoming,
  past,
  context,
  path,
}: {
  upcoming: SpaceEventItem[]
  past: SpaceEventItem[]
  context: FeedContext
  path: string
}) {
  const t = await getTranslations('SpacePost')
  if (upcoming.length === 0 && past.length === 0)
    return <EmptyState title={t('eventsEmpty')} description={t('eventsEmptyHint')} />
  const rows = (items: SpaceEventItem[]) => (
    <ul className={styles.eventRows}>
      {items.map((item) => (
        <EventRow
          key={item.type === 'post' ? `post-${item.post.id}` : `public-${item.id}`}
          item={item}
          context={context}
          href={item.type === 'post' ? `${path}/posts/${item.post.id}` : ''}
        />
      ))}
    </ul>
  )
  return (
    <div className={styles.column}>
      {upcoming.length > 0 ? (
        rows(upcoming)
      ) : (
        <p className={styles.meta}>{t('eventsNoUpcoming')}</p>
      )}
      {past.length > 0 && (
        <Accordion
          defaultOpen={-1}
          items={[{ title: t('eventsPast', { count: past.length }), content: rows(past) }]}
        />
      )}
    </div>
  )
}
