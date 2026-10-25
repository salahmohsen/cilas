'use client'

import { useLocale, useTranslations } from 'next-intl'

import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { DatePicker } from '@/components/arc/date-picker/date-picker'
import { Input } from '@/components/arc/input/input'
import { TimePicker } from '@/components/arc/time-picker/time-picker'
import { EVENT_LOCATION_MAX } from '@/lib/space-post-kinds'

import styles from './space.module.css'

/** An event's place and its Cairo day and times; `endTime` is null when the event has no end. */
export type EventValue = {
  location: string
  day: Date | undefined
  time: string
  endTime: string | null
}

/** The day as the Cairo calendar names it, read from the picker's local midnight. */
export const dayOf = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

/** The form fields that the event actions read. */
export const eventFormData = (value: EventValue, data: FormData) => {
  if (!value.day) return
  data.set('location', value.location)
  data.set('day', dayOf(value.day))
  data.set('time', value.time)
  if (value.endTime) data.set('end_time', value.endTime)
}

/** Where, which day, when it starts and, if wanted, when it ends: the composer and the edit dialog share it. */
export function EventFields({
  value,
  onChange,
  minDate,
}: {
  value: EventValue
  onChange: (patch: Partial<EventValue>) => void
  minDate?: Date
}) {
  const t = useTranslations('SpacePost')
  const locale = useLocale()
  const format = locale === 'ar' ? '24h' : '12h'
  return (
    <div className={styles.eventFields}>
      <Input
        label={t('eventLocation')}
        placeholder={t('eventLocationHint')}
        value={value.location}
        maxLength={EVENT_LOCATION_MAX}
        onChange={(e) => onChange({ location: e.currentTarget.value })}
      />
      <DatePicker
        label={t('eventDay')}
        placeholder={t('eventDayPlaceholder')}
        value={value.day}
        onChange={(day) => onChange({ day })}
        minDate={minDate}
        locale={locale}
        showToday
        labels={{
          today: t('calendarToday'),
          previous: t('calendarPrevious'),
          next: t('calendarNext'),
          clear: t('calendarClear'),
          choose: t('eventDayPlaceholder'),
          selected: (date) => t('calendarSelected', { date }),
        }}
      />
      <TimePicker
        label={t('eventTime')}
        description={t('eventTimeHint')}
        value={value.time}
        onChange={(time) => onChange({ time })}
        minuteStep={15}
        format={format}
      />
      <div className={styles.eventEnd}>
        <Checkbox
          label={t('eventEndAdd')}
          checked={value.endTime !== null}
          onCheckedChange={(on) => onChange({ endTime: on === true ? endAfter(value.time) : null })}
        />
        {value.endTime !== null && (
          <TimePicker
            label={t('eventEnd')}
            description={endsEarly(value) ? t('eventEndLater') : t('eventTimeHint')}
            value={value.endTime}
            onChange={(endTime) => onChange({ endTime })}
            minuteStep={15}
            format={format}
          />
        )}
      </div>
    </div>
  )
}

const minutes = (time: string) => {
  const [h = 0, m = 0] = time.split(':').map(Number)
  return h * 60 + m
}

/** Two hours after the start, kept on the same day. */
const endAfter = (time: string) => {
  const end = Math.min(minutes(time) + 120, 23 * 60 + 45)
  return `${String(Math.floor(end / 60)).padStart(2, '0')}:${String(end % 60).padStart(2, '0')}`
}

/** Whether the chosen end is not after the start (the end is on the start's day). */
export const endsEarly = (value: Pick<EventValue, 'time' | 'endTime'>) =>
  value.endTime !== null && minutes(value.endTime) <= minutes(value.time)
