import { CollapsibleTrigger } from '@ui-sdk/react/collapsible'
import { ChevronLeft, ChevronRight, PanelRight, Plus } from 'lucide-react'
import type { ReactNode } from 'react'

import Button from '@/components/arc/button/button'

import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'

type Props = {
  labels: CalendarLabels
  /** "November 2026" */
  months: string
  /** The host's name for the week, such as "Week 3 of 8", or null. */
  week: string | null
  /** "Nov 14 to Nov 20, 2026", said when the week changes. */
  range: string
  /** The host's own buttons, such as Edit. */
  action?: ReactNode
  /** Set in edit mode when a new item can be added. */
  onCreate?: () => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarToolbar({
  labels,
  months,
  week,
  range,
  action,
  onCreate,
  onPrevious,
  onNext,
  onToday,
}: Props) {
  return (
    <header className={styles.header}>
      <p className={styles.heading}>
        <span className={styles.months}>{months}</span>
        {week ? <span className={styles.week}>{week}</span> : null}
      </p>
      <p className={styles.srOnly} aria-live="polite">
        {range}
      </p>
      <div className={styles.controls}>
        <Button type="button" variant="secondary" size="sm" onClick={onToday}>
          {labels.today}
        </Button>
        <div className={styles.arrows}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.previousWeek}
            onClick={onPrevious}
          >
            <ChevronLeft aria-hidden size={16} strokeWidth={1.75} className={styles.flip} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={labels.nextWeek}
            onClick={onNext}
          >
            <ChevronRight aria-hidden size={16} strokeWidth={1.75} className={styles.flip} />
          </Button>
        </div>
        {action}
        {onCreate && labels.create ? (
          <Button type="button" size="sm" onClick={onCreate}>
            <Plus aria-hidden size={16} strokeWidth={1.75} />
            {labels.create}
          </Button>
        ) : null}
        <CollapsibleTrigger
          className={styles.panelToggle}
          aria-label={labels.panel}
          title={labels.panel}
        >
          <PanelRight aria-hidden size={16} strokeWidth={1.75} className={styles.flip} />
        </CollapsibleTrigger>
      </div>
    </header>
  )
}
