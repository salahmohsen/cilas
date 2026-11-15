import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Plus, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useRef, useState } from 'react'

import {
  loadSessionEdit,
  saveSessionEdit,
  type SessionEdit,
  type SessionEditResult,
} from '@/actions/session-edit'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { DatePicker } from '@/components/arc/date-picker/date-picker'
import { Input } from '@/components/arc/input/input'
import { Select } from '@/components/arc/select/select'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import { Textarea } from '@/components/arc/textarea/textarea'
import { TimePicker } from '@/components/arc/time-picker/time-picker'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { markdownBaseline, markdownToSend } from '@/components/markdown-edit'
import { RichField } from '@/components/rich-field'
import { ACTIVITY_KINDS } from '@/fields/activities'
import { MATERIAL_TYPES } from '@/fields/bibliography'
import { meetingIssue, type MeetingIssue } from '@/fields/meetings'
import type { CalendarSaveError } from '@/lib/calendar-sources'

import { dayOf } from './event-fields'
import { useLeaveQuestion } from './leave-question'
import type { ScheduleSaveText } from './schedule-save-text'
import styles from './session-form.module.css'

type Keyed<T> = T & { key: string }
type MeetingRow = Keyed<SessionEdit['meetings'][number]> & { allDay: boolean }
type Values = Omit<SessionEdit, 'meetings' | 'bibliography' | 'activities'> & {
  meetings: MeetingRow[]
  bibliography: Keyed<SessionEdit['bibliography'][number]>[]
  activities: Keyed<SessionEdit['activities'][number]>[]
}

let made = 0
/** A key for a row made on the page; a stored row keeps its id. */
const keyOf = (id?: string) => id ?? `new-${++made}`

const valuesOf = (edit: SessionEdit): Values => ({
  ...edit,
  meetings: edit.meetings.map((m) => ({
    ...m,
    key: keyOf(m.id),
    allDay: !m.start_time && !m.end_time,
  })),
  bibliography: edit.bibliography.map((m) => ({ ...m, key: keyOf(m.id) })),
  activities: edit.activities.map((a) => ({ ...a, key: keyOf(a.id) })),
})

const toSend = (values: Values): SessionEdit => ({
  ...values,
  meetings: values.meetings.map(({ key: _, allDay, ...m }) =>
    allDay ? { ...m, start_time: '', end_time: '' } : m,
  ),
  bibliography: values.bibliography.map(({ key: _, ...m }) => m),
  activities: values.activities.map(({ key: _, ...a }) => a),
})

/**
 * What is wrong with one meeting field: the one meeting rule (`meetingIssue`).
 * A meeting that is not all day and has no times yet wants both, as the rule
 * says of one time alone.
 */
const meetingFieldIssue = (
  field: 'date' | 'start_time' | 'end_time',
  row: MeetingRow,
): true | MeetingIssue => {
  if (field === 'date') return meetingIssue('date', row)
  if (row.allDay) return true
  if (!row.start_time && !row.end_time) return 'both-times'
  return meetingIssue(field, row)
}

/** A Cairo day as the date picker's local date, built from its parts. */
const dateOf = (day: string): Date | undefined => {
  const [y, m, d] = day.split('-').map(Number)
  return y && m && d ? new Date(y, m - 1, d) : undefined
}

type Loaded =
  | { status: 'loading' }
  | { status: 'failed' }
  | { status: 'ready'; values: Values; version: string; description: string }

/**
 * Loaded only through `session-drawer.tsx`, itself loaded on demand.
 *
 * The session drawer's Edit form (ADR 0011): the session's title,
 * description (Markdown, the space's editor), meetings, materials,
 * activities and Cancelled, its text in the page's language. TanStack Form
 * checks it on submit, then as it changes, and focuses the first field that
 * needs fixing; the server checks it again with the collection's own rules.
 * While it holds changes, leaving asks first.
 */
export function SessionForm({
  id,
  untitled,
  text,
  onSaved,
  onCancel,
  onUnsaved,
}: {
  id: string
  /** What the session is called with no title: "Session 3". */
  untitled: string
  /** How a refused save is worded, as every schedule save words it. */
  text: Pick<ScheduleSaveText, 'errorText' | 'reloadAndLose'>
  onSaved: (result: Extract<SessionEditResult, { ok: true }>) => void
  onCancel: () => void
  /** While the form holds changes, the way to ask before the host closes it; null when it holds none. */
  onUnsaved: (ask: ((go: () => void) => void) | null) => void
}) {
  const locale = useLocale()
  const t = useTranslations('SessionEdit')
  const tc = useTranslations('Course')
  const ts = useTranslations('Spaces')
  const tp = useTranslations('SpacePost')

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const load = useCallback(() => {
    setLoaded({ status: 'loading' })
    void loadSessionEdit(id, locale).then(
      (result) =>
        setLoaded(
          result.ok
            ? {
                status: 'ready',
                values: valuesOf(result.values),
                version: result.version,
                description: result.values.description,
              }
            : { status: 'failed' },
        ),
      () => setLoaded({ status: 'failed' }),
    )
  }, [id, locale])
  useEffect(load, [load])

  if (loaded.status === 'loading')
    return (
      <div role="status">
        <TextShimmer as="p" className={styles.note}>
          {t('loading')}
        </TextShimmer>
      </div>
    )
  if (loaded.status === 'failed')
    return (
      <Alert tone="danger" title={t('loadFailed')}>
        <div className={styles.alertActions}>
          <Button type="button" variant="secondary" size="sm" onClick={load}>
            {tp('sessionDrawerRetry')}
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            {t('cancel')}
          </Button>
        </div>
      </Alert>
    )
  return (
    <Fields
      // A reload after a stale save starts the form again from what is stored.
      key={loaded.version}
      id={id}
      base={loaded.values}
      version={loaded.version}
      storedDescription={loaded.description}
      untitled={untitled}
      errorText={text.errorText}
      reloadAndLose={text.reloadAndLose}
      onReload={load}
      onSaved={onSaved}
      onCancel={onCancel}
      onUnsaved={onUnsaved}
      words={{ t, tc, ts, tp }}
    />
  )
}

type Words = {
  t: ReturnType<typeof useTranslations<'SessionEdit'>>
  tc: ReturnType<typeof useTranslations<'Course'>>
  ts: ReturnType<typeof useTranslations<'Spaces'>>
  tp: ReturnType<typeof useTranslations<'SpacePost'>>
}

function Fields({
  id,
  base,
  version,
  storedDescription,
  untitled,
  errorText,
  reloadAndLose,
  onReload,
  onSaved,
  onCancel,
  onUnsaved,
  words: { t, tc, ts, tp },
}: {
  id: string
  base: Values
  version: string
  storedDescription: string
  untitled: string
  errorText: (error: CalendarSaveError) => string
  reloadAndLose: string
  onReload: () => void
  onSaved: (result: Extract<SessionEditResult, { ok: true }>) => void
  onCancel: () => void
  onUnsaved: (ask: ((go: () => void) => void) | null) => void
  words: Words
}) {
  const locale = useLocale()
  const root = useRef<HTMLFormElement>(null)
  const [refused, setRefused] = useState<CalendarSaveError | null>(null)
  // The editor's own rendering of the stored text, found on first edit (it needs the browser).
  const baseline = useRef<string | null>(null)

  const issueText = (issue: MeetingIssue) => t(`errors.${issue}`)

  const check = (value: Values) => {
    const fields = Object.fromEntries(
      value.meetings
        .flatMap((row, i) =>
          (['date', 'start_time', 'end_time'] as const).map((field) => {
            const issue = meetingFieldIssue(field, row)
            return [`meetings[${i}].${field}`, issue === true ? undefined : issueText(issue)]
          }),
        )
        .filter(([, error]) => error),
    )
    return Object.keys(fields).length ? { fields } : undefined
  }

  const focusFirstError = () =>
    requestAnimationFrame(() =>
      // A picker's trigger is a button, marked with data-invalid.
      root.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"], button[data-invalid]')
        ?.focus(),
    )

  const form = useForm({
    defaultValues: base,
    onSubmit: async ({ value }) => {
      setRefused(null)
      const result = await saveSessionEdit({ id, version, values: toSend(value) }, locale).catch(
        (): SessionEditResult => ({ ok: false, error: { code: 'failed' } }),
      )
      if (!result.ok) {
        setRefused(result.error)
        return
      }
      onSaved(result)
    },
    // Every field at once, so Save names all that need fixing, and each rechecks as it changes.
    validators: { onChange: ({ value }) => check(value), onSubmit: ({ value }) => check(value) },
    onSubmitInvalid: focusFirstError,
  })

  const values = useSelector(form.store, (s) => s.values)
  const dirty = JSON.stringify(values) !== JSON.stringify(base)
  const leaving = useLeaveQuestion(dirty, {
    title: ts('calendarLeaveTitle'),
    body: t('leaveBody'),
    stay: ts('calendarLeaveStay'),
    go: ts('calendarLeaveGo'),
    close: t('leaveClose'),
  })
  useEffect(() => {
    onUnsaved(dirty ? leaving.leave : null)
    // A reload or an unmount takes the question away with these fields.
    return () => onUnsaved(null)
  }, [dirty, leaving.leave, onUnsaved])

  const attempts = useSelector(form.store, (s) => s.submissionAttempts)
  const submitting = useSelector(form.store, (s) => s.isSubmitting)
  const errorOf = (field: AnyFieldApi) =>
    field.state.meta.isBlurred || attempts > 0
      ? (field.state.meta.errors.find(Boolean) as string | undefined)
      : undefined
  /** A pick is a finished answer: it shows its check at once. */
  const pick = <V,>(field: AnyFieldApi, value: V) => {
    field.handleChange(value)
    field.handleBlur()
  }

  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const timeFormat = locale === 'ar' ? '24h' : '12h'
  const remove = (label: string, onClick: () => void) => (
    <Tooltip content={label}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={styles.remove}
        aria-label={label}
        onClick={onClick}
      >
        <X size={16} aria-hidden="true" />
      </Button>
    </Tooltip>
  )

  return (
    <form
      ref={root}
      noValidate
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void form.handleSubmit()
      }}
    >
      <p className={styles.note}>{t('language')}</p>

      <form.Field name="title">
        {(field) => (
          <Input
            label={t('title')}
            autoFocus
            description={t('titleHint', { name: untitled })}
            placeholder={untitled}
            dir={dir}
            value={field.state.value}
            onChange={(e) => field.handleChange(e.target.value)}
            onBlur={field.handleBlur}
          />
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <RichField
            label={t('description')}
            dir={dir}
            defaultMarkdown={storedDescription}
            onChange={(value) => {
              baseline.current ??= markdownBaseline(storedDescription)
              field.handleChange(
                markdownToSend(storedDescription, value.markdown, baseline.current),
              )
            }}
          />
        )}
      </form.Field>

      <form.Field name="meetings" mode="array">
        {(meetings) => (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{t('meetings')}</legend>
            {meetings.state.value.map((row, i) => (
              <div key={row.key} className={styles.meeting}>
                <form.Field name={`meetings[${i}].date`}>
                  {(field) => (
                    <div className={styles.day}>
                      <DatePicker
                        label={t('day')}
                        placeholder={t('dayPlaceholder')}
                        value={dateOf(field.state.value)}
                        onChange={(date) => pick(field, date ? dayOf(date) : '')}
                        onBlur={field.handleBlur}
                        locale={locale}
                        showToday
                        error={errorOf(field)}
                        labels={{
                          today: tp('calendarToday'),
                          previous: tp('calendarPrevious'),
                          next: tp('calendarNext'),
                          clear: tp('calendarClear'),
                          choose: t('dayPlaceholder'),
                          selected: (date) => tp('calendarSelected', { date }),
                        }}
                      />
                    </div>
                  )}
                </form.Field>
                <div className={styles.removeCell}>
                  {remove(t('removeMeeting', { n: i + 1 }), () => meetings.removeValue(i))}
                </div>
                {row.allDay ? null : (
                  <>
                    <form.Field name={`meetings[${i}].start_time`}>
                      {(field) => (
                        <TimePicker
                          className={styles.start}
                          label={t('starts')}
                          placeholder={t('timePlaceholder')}
                          value={field.state.value}
                          onChange={(time) => pick(field, time)}
                          minuteStep={15}
                          format={timeFormat}
                          error={errorOf(field)}
                        />
                      )}
                    </form.Field>
                    <form.Field name={`meetings[${i}].end_time`}>
                      {(field) => (
                        <TimePicker
                          className={styles.end}
                          label={t('ends')}
                          placeholder={t('timePlaceholder')}
                          value={field.state.value}
                          onChange={(time) => pick(field, time)}
                          minuteStep={15}
                          format={timeFormat}
                          error={errorOf(field)}
                        />
                      )}
                    </form.Field>
                  </>
                )}
                <form.Field name={`meetings[${i}].allDay`}>
                  {(field) => (
                    <div className={styles.allDay}>
                      <Checkbox
                        label={t('allDay')}
                        checked={field.state.value}
                        onCheckedChange={(on) => field.handleChange(on === true)}
                      />
                    </div>
                  )}
                </form.Field>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  // A new meeting keeps the last one's times; its day is the person's to pick.
                  const last = meetings.state.value.at(-1)
                  meetings.pushValue({
                    key: keyOf(),
                    date: '',
                    start_time: last?.start_time ?? '',
                    end_time: last?.end_time ?? '',
                    allDay: last?.allDay ?? false,
                  })
                }}
              >
                <Plus size={16} aria-hidden="true" />
                {t('addMeeting')}
              </Button>
            </div>
          </fieldset>
        )}
      </form.Field>

      <form.Field name="bibliography" mode="array">
        {(materials) => (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{tc('materials')}</legend>
            {materials.state.value.map((row, i) => (
              <div key={row.key} className={styles.material}>
                <form.Field name={`bibliography[${i}].type`}>
                  {(field) => (
                    <div className={styles.kind}>
                      <Select
                        label={t('materialType')}
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as (typeof MATERIAL_TYPES)[number])
                        }
                        options={MATERIAL_TYPES.map((value) => ({
                          value,
                          label: tc(`materialTypes.${value}`),
                        }))}
                      />
                    </div>
                  )}
                </form.Field>
                <div className={styles.removeCell}>
                  {remove(t('removeMaterial', { n: i + 1 }), () => materials.removeValue(i))}
                </div>
                <form.Field name={`bibliography[${i}].title`}>
                  {(field) => (
                    <Input
                      label={t('materialTitle')}
                      dir={dir}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
                <form.Field name={`bibliography[${i}].note`}>
                  {(field) => (
                    <Input
                      label={t('materialNote')}
                      description={t('materialNoteHint')}
                      dir={dir}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
                <form.Field name={`bibliography[${i}].href`}>
                  {(field) => (
                    <Input
                      label={t('materialLink')}
                      type="url"
                      inputMode="url"
                      placeholder="https://"
                      dir="ltr"
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  materials.pushValue({
                    key: keyOf(),
                    type: 'reading',
                    title: '',
                    href: '',
                    note: '',
                  })
                }
              >
                <Plus size={16} aria-hidden="true" />
                {t('addMaterial')}
              </Button>
            </div>
          </fieldset>
        )}
      </form.Field>

      <form.Field name="activities" mode="array">
        {(activities) => (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{tc('activities')}</legend>
            {activities.state.value.map((row, i) => (
              <div key={row.key} className={styles.activity}>
                <form.Field name={`activities[${i}].kind`}>
                  {(field) => (
                    <div className={styles.kind}>
                      <Select
                        label={t('activityKind')}
                        value={field.state.value}
                        onValueChange={(value) =>
                          field.handleChange(value as (typeof ACTIVITY_KINDS)[number])
                        }
                        options={ACTIVITY_KINDS.map((value) => ({
                          value,
                          label: tc(`activityKinds.${value}`),
                        }))}
                      />
                    </div>
                  )}
                </form.Field>
                <div className={styles.removeCell}>
                  {remove(t('removeActivity', { n: i + 1 }), () => activities.removeValue(i))}
                </div>
                <form.Field name={`activities[${i}].description`}>
                  {(field) => (
                    <Textarea
                      label={t('activityDescription')}
                      dir={dir}
                      rows={2}
                      value={field.state.value}
                      onChange={(e) => field.handleChange(e.target.value)}
                      onBlur={field.handleBlur}
                    />
                  )}
                </form.Field>
              </div>
            ))}
            <div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() =>
                  activities.pushValue({ key: keyOf(), kind: 'discussion', description: '' })
                }
              >
                <Plus size={16} aria-hidden="true" />
                {t('addActivity')}
              </Button>
            </div>
          </fieldset>
        )}
      </form.Field>

      <form.Field name="cancelled">
        {(field) => (
          <Checkbox
            label={t('cancelled')}
            description={t('cancelledHint')}
            checked={field.state.value}
            onCheckedChange={(on) => field.handleChange(on === true)}
          />
        )}
      </form.Field>

      {refused ? (
        <Alert tone="danger" title={errorText(refused)}>
          {refused.code === 'stale' ? (
            <div className={styles.alertActions}>
              <Button type="button" variant="secondary" size="sm" onClick={onReload}>
                {reloadAndLose}
              </Button>
            </div>
          ) : null}
        </Alert>
      ) : null}

      <div className={styles.foot}>
        <Button type="submit" loading={submitting}>
          {t('save')}
        </Button>
        <Button type="button" variant="secondary" onClick={() => leaving.leave(onCancel)}>
          {t('cancel')}
        </Button>
      </div>

      {leaving.dialog}
    </form>
  )
}
