import { ChevronLeft, ChevronRight } from 'lucide-react'

import Button from '@/components/arc/button/button'
import SegmentedControl from '@/components/arc/segmented-control/segmented-control'

import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'

type Props = {
  labels: CalendarLabels
  range: string
  hour12: boolean
  onHour12: (hour12: boolean) => void
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
}

export function CalendarToolbar({
  labels,
  range,
  hour12,
  onHour12,
  onPrevious,
  onNext,
  onToday,
}: Props) {
  return (
    <header className={styles.header}>
      <div className={styles.nav}>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={labels.previousWeek}
          onClick={onPrevious}
        >
          <ChevronLeft aria-hidden size={16} className={styles.flip} />
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          aria-label={labels.nextWeek}
          onClick={onNext}
        >
          <ChevronRight aria-hidden size={16} className={styles.flip} />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onToday}>
          {labels.today}
        </Button>
        <p className={styles.range} aria-live="polite">
          {range}
        </p>
      </div>
      <div className={styles.controls}>
        <SegmentedControl
          label={labels.timeFormat}
          value={hour12 ? '12' : '24'}
          onValueChange={(value) => onHour12(value === '12')}
          options={[
            { value: '24', label: labels.hours24 },
            { value: '12', label: labels.hours12 },
          ]}
        />
      </div>
    </header>
  )
}
