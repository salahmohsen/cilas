'use client'

import { Dialog, DialogContent, DialogTitle } from '@ui-sdk/react/dialog'
import { useRef, useState } from 'react'
import { Button } from '@/components/arc/button/button'
import { DatePicker } from '@/components/arc/date-picker/date-picker'
import { TimePicker } from '@/components/arc/time-picker/time-picker'
import type { EditBlock } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { formatTime, toMinutes, toTime } from './calendar-time'
import styles from './calendar.module.css'

export function MoveDialog({
  block,
  labels,
  locale,
  range,
  onApply,
  onCancel,
  finalFocus,
}: {
  block: EditBlock
  labels: CalendarLabels
  locale: string
  range: { min: number; max: number }
  onApply: (day: string, start: number, end: number) => void
  onCancel: () => void
  finalFocus: () => HTMLElement | null
}) {
  const words = labels.move
  const [day, setDay] = useState(block.track)
  const [start, setStart] = useState(toTime(block.start))
  const [end, setEnd] = useState(toTime(block.end))
  const [tried, setTried] = useState(false)
  const fields = useRef<HTMLFormElement>(null)
  const from = toMinutes(start),
    to = toMinutes(end)
  const rangeError = words.rangeError(formatTime(range.min, locale), formatTime(range.max, locale))
  const startError = from < range.min || from >= range.max ? rangeError : undefined
  const endError =
    to <= from ? words.orderError : to > range.max || to < range.min ? rangeError : undefined
  const [year, month, date] = day.split('-').map(Number)
  const clock = (value: string) => formatTime(toMinutes(value), locale)
  return (
    <Dialog
      defaultOpen
      onOpenChange={(open) => {
        if (!open) onCancel()
      }}
    >
      <DialogContent
        className={`arc-scope ${styles.moveDialog}`}
        dir={locale === 'ar' ? 'rtl' : 'ltr'}
        initialFocus={() => fields.current?.querySelector('button') ?? null}
        finalFocus={finalFocus}
      >
        <DialogTitle>{words.title}</DialogTitle>
        <form
          ref={fields}
          className={styles.moveForm}
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setTried(true)
            if (!day || (!block.allDay && (startError || endError))) {
              fields.current?.querySelector<HTMLElement>('[data-invalid]')?.focus()
              return
            }
            onApply(day, block.allDay ? 0 : from, block.allDay ? 0 : to)
          }}
        >
          <DatePicker
            label={words.day}
            placeholder={words.day}
            value={day ? new Date(year!, month! - 1, date) : undefined}
            onChange={(value) =>
              setDay(
                value
                  ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
                  : '',
              )
            }
            locale={locale}
            weekStartsOn={6}
            error={tried && !day ? words.dayError : undefined}
            labels={{
              today: labels.today,
              previous: labels.previous('month', 1),
              next: labels.next('month', 1),
              clear: words.clear,
              choose: words.day,
              selected: words.selected,
            }}
          />
          {!block.allDay && (
            <>
              <TimePicker
                label={words.start}
                optionsLabel={words.start}
                value={start}
                onChange={setStart}
                formatValue={clock}
                error={tried ? startError : undefined}
              />
              <TimePicker
                label={words.end}
                optionsLabel={words.end}
                value={end}
                onChange={setEnd}
                formatValue={clock}
                error={tried ? endError : undefined}
              />
            </>
          )}
          <div className={styles.moveActions}>
            <Button type="button" variant="secondary" onClick={onCancel}>
              {words.cancel}
            </Button>
            <Button type="submit">{words.apply}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
