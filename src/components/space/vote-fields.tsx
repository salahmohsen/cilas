'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Plus, X } from 'lucide-react'

import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { DatePicker } from '@/components/arc/date-picker/date-picker'
import { Input } from '@/components/arc/input/input'
import { TimePicker } from '@/components/arc/time-picker/time-picker'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { VOTE_OPTIONS } from '@/lib/space-rules'

import { dayOf } from './event-fields'
import styles from './space.module.css'

/** One option row: a stored option keeps its id (and its choices); a new one has none. */
export type VoteOptionValue = { id: string | null; label: string; votes: number }

/**
 * A vote's options, its choice rules and, if wanted, when it closes (a Cairo
 * day and time). `closes` is null for a vote that stays open.
 */
export type VoteValue = {
  options: VoteOptionValue[]
  multiple: boolean
  anonymous: boolean
  closes: { day: Date | undefined; time: string } | null
}

export const EMPTY_VOTE: VoteValue = {
  options: [
    { id: null, label: '', votes: 0 },
    { id: null, label: '', votes: 0 },
  ],
  multiple: false,
  anonymous: false,
  closes: null,
}

/** The labels a vote may be saved with: at least two, and no row left empty. */
export const voteReady = (value: VoteValue) =>
  value.options.filter((o) => o.label.trim()).length >= VOTE_OPTIONS.min &&
  (value.closes === null || value.closes.day !== undefined)

/** The fields the vote actions read; `withIds` sends each option as "id|label" for an edit. */
export const voteFormData = (value: VoteValue, data: FormData, withIds = false) => {
  for (const o of value.options) {
    if (!o.label.trim()) continue
    data.append('option', withIds ? `${o.id ?? ''}|${o.label}` : o.label)
  }
  data.set('multiple', String(value.multiple))
  data.set('anonymous', String(value.anonymous))
  if (value.closes?.day) {
    data.set('closes_day', dayOf(value.closes.day))
    data.set('closes_time', value.closes.time)
  }
}

/**
 * The composer's and the edit dialog's vote fields. Once members have voted,
 * `locks` keeps the promises made to them: an anonymous vote stays anonymous,
 * and several choices stay allowed while someone holds more than one.
 */
export function VoteFields({
  value,
  onChange,
  locks = { anonymous: false, multiple: false },
}: {
  value: VoteValue
  onChange: (patch: Partial<VoteValue>) => void
  locks?: { anonymous: boolean; multiple: boolean }
}) {
  const t = useTranslations('SpacePost')
  const locale = useLocale()
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const setOption = (index: number, label: string) =>
    onChange({ options: value.options.map((o, i) => (i === index ? { ...o, label } : o)) })
  return (
    <fieldset className={styles.voteFields}>
      <legend className={styles.fieldLegend}>{t('voteOptions')}</legend>
      {value.options.map((option, index) => (
        <div key={option.id ?? `new-${index}`} className={styles.optionRow}>
          <Input
            label={t('voteOption', { n: index + 1 })}
            description={
              option.votes > 0 ? t('voteOptionVotes', { count: option.votes }) : undefined
            }
            value={option.label}
            maxLength={VOTE_OPTIONS.length}
            onChange={(e) => setOption(index, e.currentTarget.value)}
          />
          {value.options.length > VOTE_OPTIONS.min && (
            <Tooltip
              content={
                option.votes > 0
                  ? t('voteRemoveOptionVoted', { count: option.votes })
                  : t('voteRemoveOption', { n: index + 1 })
              }
            >
              <Button
                variant="ghost"
                size="sm"
                aria-label={t('voteRemoveOption', { n: index + 1 })}
                onClick={() => onChange({ options: value.options.filter((_, i) => i !== index) })}
              >
                <X size={16} aria-hidden="true" />
              </Button>
            </Tooltip>
          )}
        </div>
      ))}
      {value.options.length < VOTE_OPTIONS.max && (
        <div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              onChange({ options: [...value.options, { id: null, label: '', votes: 0 }] })
            }
          >
            <Plus size={16} aria-hidden="true" />
            {t('voteAddOption')}
          </Button>
        </div>
      )}
      <Checkbox
        label={t('voteMultiple')}
        description={locks.multiple ? t('voteMultipleLocked') : t('voteMultipleHint')}
        checked={value.multiple}
        disabled={locks.multiple}
        onCheckedChange={(v) => onChange({ multiple: v === true })}
      />
      <Checkbox
        label={t('voteAnonymous')}
        description={locks.anonymous ? t('voteAnonymousLocked') : t('voteAnonymousHint')}
        checked={value.anonymous}
        disabled={locks.anonymous}
        onCheckedChange={(v) => onChange({ anonymous: v === true })}
      />
      <Checkbox
        label={t('voteClosesAdd')}
        description={t('voteClosesHint')}
        checked={value.closes !== null}
        onCheckedChange={(on) =>
          onChange({ closes: on === true ? { day: undefined, time: '18:00' } : null })
        }
      />
      {value.closes && (
        <div className={styles.eventFields}>
          <DatePicker
            label={t('voteClosesDay')}
            placeholder={t('eventDayPlaceholder')}
            value={value.closes.day}
            onChange={(day) => onChange({ closes: { ...value.closes!, day } })}
            minDate={today}
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
            label={t('voteClosesTime')}
            description={t('eventTimeHint')}
            value={value.closes.time}
            onChange={(time) => onChange({ closes: { ...value.closes!, time } })}
            minuteStep={15}
            format={locale === 'ar' ? '24h' : '12h'}
          />
        </div>
      )}
    </fieldset>
  )
}
