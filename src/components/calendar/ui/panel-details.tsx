import { ArrowLeft } from 'lucide-react'
import { useEffect, useId, useRef } from 'react'

import type { CalendarItem } from '@/lib/calendar-items'

import type { CalendarAction, DetailsTarget } from './block-details'
import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'
import { ItemDetails } from './item-details'

/** The panel's width in px, for the picture's `sizes`: the panel is 17rem, and Payload's admin sets its own root font size. */
const PANEL_IMAGE_WIDTH = 272

/**
 * An item's details in the side panel, in place of the day or Up next, with a
 * Back button that names where it goes. Focus goes to the heading when the
 * details open; the host puts it back on the block when they close.
 */
export function PanelDetails({
  item,
  target,
  labels,
  locale,
  where,
  actions,
  onBack,
  onRun,
}: {
  item: CalendarItem
  target: DetailsTarget
  labels: CalendarLabels
  locale: string
  /** Where Back goes: its short text, and its whole name for assistive technology. */
  where: { text: string; name: string }
  actions: CalendarAction[]
  onBack: () => void
  onRun: (action: CalendarAction) => void
}) {
  const titleId = useId()
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus()
  }, [])
  return (
    <section className={styles.panelDetails} aria-labelledby={titleId}>
      <button
        type="button"
        className={styles.back}
        aria-label={labels.backTo(where.name)}
        onClick={onBack}
      >
        <ArrowLeft aria-hidden className={styles.flip} size={16} strokeWidth={1.75} />
        <span>{where.text}</span>
      </button>
      <ItemDetails
        item={item}
        target={target}
        labels={labels}
        locale={locale}
        imageWidth={PANEL_IMAGE_WIDTH}
        heading={
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            data-panel-heading=""
            className={styles.detailsTitle}
            dir="auto"
          >
            {item.title}
          </h2>
        }
        actions={actions}
        onRun={onRun}
      />
    </section>
  )
}
