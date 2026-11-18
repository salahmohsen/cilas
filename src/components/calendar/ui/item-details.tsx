import { AlignLeft, Clock, Library, MapPin } from 'lucide-react'
import Image from 'next/image'
import type { ReactNode } from 'react'

import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import type { CalendarAction, DetailsTarget } from './block-details'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatLength, formatTimeRange } from './calendar-time'
import styles from './calendar.module.css'
import { ItemActions } from './item-actions'

const longDate = { weekday: 'long', day: 'numeric', month: 'long' } as const

/**
 * What an item's details say, in the popover, the sheet and the side panel:
 * tone and title, caption, when, where, a start of the summary, and the
 * actions. The caller gives the heading element, which each place names
 * and focuses in its own way.
 */
export function ItemDetails({
  item,
  target,
  labels,
  locale,
  heading,
  trailing,
  imageWidth,
  floating = false,
  actions,
  onLink,
  onRun,
}: {
  item: CalendarItem
  target: Pick<DetailsTarget, 'blocks'>
  labels: CalendarLabels
  locale: string
  /** The title as a heading element. */
  heading: ReactNode
  /** What ends the heading line, such as a close button. */
  trailing?: ReactNode
  /** Shows the item's picture, in a place this wide in px; none where there is no room. */
  imageWidth?: number
  /** In a floating popover: its menu renders inside it. */
  floating?: boolean
  actions: CalendarAction[]
  /** A link was followed. */
  onLink?: () => void
  onRun: (action: CalendarAction) => void
}) {
  const [first] = target.blocks
  const last = target.blocks.at(-1)
  return (
    <>
      {imageWidth && item.image ? (
        <div className={styles.detailsImage}>
          <Image
            fill
            sizes={`${imageWidth}px`}
            alt={item.image.alt}
            src={item.image.url}
            style={{ objectPosition: item.image.position }}
          />
        </div>
      ) : null}
      <div className={styles.detailsHead} data-tone={item.tone}>
        <span className={styles.detailsMark} aria-hidden />
        {heading}
        {trailing}
      </div>

      {item.caption || item.cancelled ? (
        <p className={styles.detailsCaption}>
          {item.caption ? (
            <span className={styles.detailsCaptionText} dir="auto">
              {item.caption}
            </span>
          ) : null}
          {item.cancelled ? (
            <span className={styles.detailsCancelled}>{labels.cancelled}</span>
          ) : null}
        </p>
      ) : null}

      <ul className={styles.detailsRows}>
        <li>
          <Clock aria-hidden size={16} strokeWidth={1.75} />
          {first && last ? (
            <span className={styles.detailsWhen}>
              <span>
                {first === last
                  ? formatDay(first.track, locale, longDate)
                  : labels.range(
                      formatDay(first.track, locale, longDate),
                      formatDay(last.track, locale, longDate),
                    )}
              </span>
              {first.allDay ? (
                <span className={styles.detailsMuted}>{labels.allDay}</span>
              ) : (
                <span className={styles.detailsMuted}>
                  <span dir={timeDir(locale)}>
                    {formatTimeRange(first.start, first.end, locale)}
                  </span>
                  {' · '}
                  {formatLength(first.end - first.start, locale)}
                </span>
              )}
            </span>
          ) : (
            <span>{labels.unscheduled}</span>
          )}
        </li>
        {item.place ? (
          <li>
            <MapPin aria-hidden size={16} strokeWidth={1.75} />
            <span dir="auto">{item.place}</span>
          </li>
        ) : null}
        {item.more ? (
          <li>
            <Library aria-hidden size={16} strokeWidth={1.75} />
            <a className={styles.detailsMore} href={item.more.href} onClick={onLink}>
              {item.more.label}
            </a>
          </li>
        ) : null}
        {item.summary ? (
          <li>
            <AlignLeft aria-hidden size={16} strokeWidth={1.75} />
            <span className={styles.detailsSummary} dir="auto">
              {item.summary}
            </span>
          </li>
        ) : null}
      </ul>

      <ItemActions
        label={item.title}
        menuLabel={labels.moreActions}
        actions={actions}
        floating={floating}
        onLink={onLink}
        onRun={onRun}
      />
    </>
  )
}
