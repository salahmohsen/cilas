import Button from '@/components/arc/button/button'

import type { CalendarLabels } from './calendar-labels'
import styles from './calendar.module.css'
import { CalendarSaveRefusal } from './save-refusal'

type Props = {
  labels: CalendarLabels
  count: number
  saving: boolean
  error: Error | null
  /** What the last menu action did, since its block may be on a day or week not in view. */
  note?: string
  onSave: () => void
  /** The pointer or focus reached Save. */
  onSaveIntent?: () => void
  onCancel: () => void
  /** Drops every unsaved change, for a refusal's way out. */
  onDiscard: () => void
  /** Closes a note that has no change left beside it. */
  onDismiss: () => void
}

export function SaveBar({
  labels,
  count,
  saving,
  error,
  note,
  onSave,
  onSaveIntent,
  onCancel,
  onDiscard,
  onDismiss,
}: Props) {
  const discard = error instanceof CalendarSaveRefusal ? error.discard : null
  return (
    <div className={styles.bar}>
      {error ? (
        <div className={styles.barRow}>
          <p role="alert" className={styles.error}>
            {labels.saveFailed} {error.message}
          </p>
          {discard ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                onDiscard()
                discard.then()
              }}
            >
              {discard.label}
            </Button>
          ) : null}
        </div>
      ) : null}
      {note ? (
        // The status region of the calendar says it aloud already.
        <p aria-hidden className={styles.barNote}>
          {note}
        </p>
      ) : null}
      {count ? (
        <div className={styles.barRow}>
          <p aria-hidden className={styles.barCount}>
            {labels.changes(count)}
          </p>
          <div className={styles.barActions}>
            <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
              {labels.cancelEdits}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={onSave}
              onPointerEnter={onSaveIntent}
              onPointerDown={onSaveIntent}
              onFocus={onSaveIntent}
              disabled={saving}
              loading={saving}
            >
              {saving ? labels.saving : labels.save}
            </Button>
          </div>
        </div>
      ) : (
        <div className={styles.barActions}>
          <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
            {labels.dismiss}
          </Button>
        </div>
      )}
    </div>
  )
}
