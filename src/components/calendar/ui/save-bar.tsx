import Button from '@/components/arc/button/button'

import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'

type Props = {
  labels: CalendarLabels
  count: number
  saving: boolean
  error: Error | null
  /** What the last menu action did, since its block may be on a day or week not in view. */
  note?: string
  onSave: () => void
  onCancel: () => void
}

export function SaveBar({ labels, count, saving, error, note, onSave, onCancel }: Props) {
  return (
    <div className={styles.bar}>
      {error ? (
        <p role="alert" className={styles.error}>
          {labels.saveFailed} {error.message}
        </p>
      ) : null}
      {note ? (
        // The status region of the calendar says it aloud already.
        <p aria-hidden className={styles.barNote}>
          {note}
        </p>
      ) : null}
      <div className={styles.barRow}>
        <p aria-hidden className={styles.barCount}>
          {labels.changes(count)}
        </p>
        <div className={styles.barActions}>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
            {labels.cancelEdits}
          </Button>
          <Button type="button" size="sm" onClick={onSave} disabled={saving} loading={saving}>
            {saving ? labels.saving : labels.save}
          </Button>
        </div>
      </div>
    </div>
  )
}
