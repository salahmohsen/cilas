import { AlignLeft, Clock, Ellipsis, MapPin } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { ButtonGroup } from '@/components/arc/button-group/button-group'
import { Button } from '@/components/arc/button/button'
import button from '@/components/arc/button/button.module.css'
import DropdownMenu from '@/components/arc/dropdown-menu/dropdown-menu'
import { timeDir } from '@/lib/digits'
import type { CalendarItem } from '@/lib/calendar-items'

import type { CalendarAction, DetailsTarget } from './block-details'
import type { CalendarLabels } from './calendar-labels'
import { formatDay, formatLength, formatTimeRange } from './calendar-time'
import styles from './calendar.module.css'

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
          {item.caption ? <span dir="auto">{item.caption}</span> : null}
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
        {item.summary ? (
          <li>
            <AlignLeft aria-hidden size={16} strokeWidth={1.75} />
            <span className={styles.detailsSummary} dir="auto">
              {item.summary}
            </span>
          </li>
        ) : null}
      </ul>

      <ItemActions item={item} actions={actions} labels={labels} onLink={onLink} onRun={onRun} />
    </>
  )
}

/**
 * The buttons and links of an item, and, for the actions that ask for it, the
 * "⋯" menu of the rarer ones. The row keeps its height whether or not the
 * host's late actions have come (decision 15).
 */
function ItemActions({
  item,
  actions,
  labels,
  onLink,
  onRun,
}: {
  item: CalendarItem
  actions: CalendarAction[]
  labels: CalendarLabels
  onLink?: () => void
  onRun: (action: CalendarAction) => void
}) {
  const buttons = actions.filter((action) => !action.menu)
  const menu = actions.filter((action) => action.menu && action.run)
  if (!buttons.length && !menu.length) return null
  return (
    <div className={styles.detailsActions}>
      {buttons.length > 1 && buttons.every((action) => action.href) ? (
        <ButtonGroup
          label={item.title}
          size="sm"
          items={buttons.map((action) => ({
            id: action.id,
            label: action.label,
            href: action.href,
            onSelect: onLink,
          }))}
        />
      ) : (
        buttons.map((action) =>
          action.href ? (
            <Link
              key={action.id}
              href={action.href}
              className={[
                button.button,
                button[action.primary ? 'primary' : 'secondary'],
                button.sm,
                styles.detailsLink,
              ].join(' ')}
              onClick={onLink}
            >
              {action.icon}
              {action.label}
            </Link>
          ) : (
            <Button
              key={action.id}
              type="button"
              size="sm"
              variant={action.primary ? 'primary' : 'secondary'}
              onPointerEnter={action.preload}
              onFocus={action.preload}
              onPointerDown={action.preload}
              onClick={() => onRun(action)}
            >
              {action.icon}
              {action.label}
            </Button>
          ),
        )
      )}
      {menu.length ? (
        <DropdownMenu
          label={labels.moreActions}
          iconOnly
          icon={<Ellipsis aria-hidden size={16} />}
          items={menu.map((action) => ({
            label: action.label,
            destructive: action.danger,
            onPreload: action.preload,
            onSelect: () => onRun(action),
          }))}
        />
      ) : null}
    </div>
  )
}
