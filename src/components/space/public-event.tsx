import { getTranslations } from 'next-intl/server'

import { Badge } from '@/components/arc/badge/badge'
import { eventOver } from '@/lib/space-event'
import { POSTER_COLORS } from '@/lib/poster-colors'
import type { SpaceEventItem } from '@/lib/spaces-data'

import { EventFace, EventPlace, EventWhen } from './event-details'

/**
 * A public event of the course in the Events tab: the same face as an event
 * post, marked as public, without answers, since a public event takes none here.
 */
export async function PublicEvent({
  item,
  now,
}: {
  item: Extract<SpaceEventItem, { type: 'public' }>
  /** When the page rendered */
  now: string
}) {
  const t = await getTranslations('SpacePost')
  const over = eventOver(item.startsAt, item.endsAt, new Date(now))
  return (
    <EventFace
      color={POSTER_COLORS[1]}
      title={item.title}
      cover={null}
      startsAt={item.startsAt}
      over={over}
      label={t('publicEventAria', { title: item.title })}
      badge={
        <Badge size="sm" tone="info">
          {t('publicEvent')}
        </Badge>
      }
      when={<EventWhen startsAt={item.startsAt} endsAt={item.endsAt} over={over} />}
      where={item.place ? <EventPlace location={item.place} place={null} /> : null}
    />
  )
}
