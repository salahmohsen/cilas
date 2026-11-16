import { useForm, useSelector, type AnyFieldApi } from '@tanstack/react-form'
import { Plus, X } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'

import { loadSessionEdit, type SessionEdit } from '@/actions/session-edit'
import { saveScheduleEdits, type ScheduleEditsResult } from '@/actions/save-schedule-edits'
import { Alert } from '@/components/arc/alert/alert'
import { Button } from '@/components/arc/button/button'
import { Checkbox } from '@/components/arc/checkbox/checkbox'
import { DatePicker } from '@/components/arc/date-picker/date-picker'
import { HoldToConfirm } from '@/components/arc/hold-to-confirm/hold-to-confirm'
import { Input } from '@/components/arc/input/input'
import { TextShimmer } from '@/components/arc/text-shimmer/text-shimmer'
import { TimePicker } from '@/components/arc/time-picker/time-picker'
import { Tooltip } from '@/components/arc/tooltip/tooltip'
import { markdownBaseline, markdownToSend } from '@/components/markdown-edit'
import { formatTime } from '@/components/calendar/ui/calendar-time'
import { RichField } from '@/components/rich-field'
import { meetingIssue, type MeetingIssue } from '@/fields/meetings'
import type { CalendarSaveError } from '@/lib/calendar-sources'

import { CardList } from './card-list'
import { dayOf } from './event-fields'
import { useLeaveQuestion } from './leave-question'
import type { ScheduleSaveText } from './schedule-save-text'
import { activityKind, materialKind } from './session-cards'
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
export type SessionFormStage = {
  values: SessionEdit
  version: string
  apply: (values: SessionEdit) => void
  remove: () => void
}

export function SessionForm({
  id,
  untitled,
  text,
  onSaved,
  onCancel,
  onUnsaved,
  stage,
  contentLocale,
}: {
  contentLocale?: string
  stage?: SessionFormStage
  id: string
  /** What the session is called with no title: "Session 3". */
  untitled: string
  /** How a refused save is worded, as every schedule save words it. */
  text: Pick<ScheduleSaveText, 'errorText' | 'reloadAndLose'>
  onSaved: (result: Extract<ScheduleEditsResult, { ok: true }>) => void
  onCancel: () => void
  /** While the form holds changes, the way to ask before the host closes it; null when it holds none. */
  onUnsaved: (ask: ((go: () => void) => void) | null) => void
}) {
  const language = useLocale()
  const locale = contentLocale ?? language
  const t = useTranslations('SessionEdit')
  const tc = useTranslations('Course')
  const ts = useTranslations('Spaces')
  const tp = useTranslations('SpacePost')

  const [loaded, setLoaded] = useState<Loaded>({ status: 'loading' })
  const load = useCallback(() => {
    if (stage) {
      setLoaded({
        status: 'ready',
        values: valuesOf(stage.values),
        version: stage.version,
        description: stage.values.description,
      })
      return
    }
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
  }, [id, locale, stage])
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
      stage={stage}
      contentLocale={locale}
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
  contentLocale,
  stage,
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
  stage?: SessionFormStage
  contentLocale: string
  base: Values
  version: string
  storedDescription: string
  untitled: string
  errorText: (error: CalendarSaveError) => string
  reloadAndLose: string
  onReload: () => void
  onSaved: (result: Extract<ScheduleEditsResult, { ok: true }>) => void
  onCancel: () => void
  onUnsaved: (ask: ((go: () => void) => void) | null) => void
  words: Words
}) {
  const locale = contentLocale
  const root = useRef<HTMLFormElement>(null)
  /** Held to the end: the hold button shows it is done until a refused delete resets it. */
  const [deleted, setDeleted] = useState(false)
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
      if (stage) {
        stage.apply(toSend(value))
        return
      }
      const { meetings, ...values } = toSend(value)
      const result = await saveScheduleEdits(
        { details: [{ op: 'edit', id, version, values, meetings }] },
        locale,
      ).catch((): ScheduleEditsResult => ({ ok: false, error: { code: 'failed' } }))
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
  /** The calendar's one 12-hour form, in the page's language (decision 7). */
  const timeOf = (value: string) => {
    const [h = 0, m = 0] = value.split(':').map(Number)
    return formatTime(h * 60 + m, locale)
  }
  const materials = useMemo(() => materialKind({ t, tc, dir }), [t, tc, dir])
  const activities = useMemo(() => activityKind({ t, tc, dir }), [t, tc, dir])
  const meetingId = useId()

  const removeSession = async () => {
    setDeleted(true)
    if (stage) {
      stage.remove()
      return
    }
    setRefused(null)
    const result = await saveScheduleEdits(
      { details: [{ op: 'delete', id, version }] },
      locale,
    ).catch((): ScheduleEditsResult => ({ ok: false, error: { code: 'failed' } }))
    if (result.ok) onSaved(result)
    else {
      setDeleted(false)
      setRefused(result.error)
    }
  }

  return (
    <form
      ref={root}
      noValidate
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      <form.Field name="title">
        {(field) => (
          <Input
            label={t('title')}
            autoFocus
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
            placeholder=""
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

      {!stage && (
        <form.Field name="meetings" mode="array">
          {(meetings) => (
            <fieldset className={styles.group}>
              <legend className={styles.legend}>{t('meetings')}</legend>
              {meetings.state.value.map((row, i) => (
                <div
                  key={row.key}
                  role="group"
                  aria-labelledby={`${meetingId}-${row.key}`}
                  className={styles.meeting}
                >
                  <div className={styles.meetingHead}>
                    <span id={`${meetingId}-${row.key}`} className={styles.meetingName}>
                      {t('meeting', { n: i + 1 })}
                    </span>
                    <Tooltip content={t('removeMeeting', { n: i + 1 })}>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={styles.remove}
                        aria-label={t('removeMeeting', { n: i + 1 })}
                        onClick={() => meetings.removeValue(i)}
                      >
                        <X size={16} aria-hidden="true" />
                      </Button>
                    </Tooltip>
                  </div>
                  <form.Field name={`meetings[${i}].date`}>
                    {(field) => (
                      <div className={styles.wide}>
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
                  {row.allDay ? null : (
                    <>
                      <form.Field name={`meetings[${i}].start_time`}>
                        {(field) => (
                          <TimePicker
                            label={t('starts')}
                            placeholder={t('timePlaceholder')}
                            value={field.state.value}
                            onChange={(time) => pick(field, time)}
                            minuteStep={15}
                            formatValue={timeOf}
                            error={errorOf(field)}
                          />
                        )}
                      </form.Field>
                      <form.Field name={`meetings[${i}].end_time`}>
                        {(field) => (
                          <TimePicker
                            label={t('ends')}
                            placeholder={t('timePlaceholder')}
                            value={field.state.value}
                            onChange={(time) => pick(field, time)}
                            minuteStep={15}
                            formatValue={timeOf}
                            error={errorOf(field)}
                          />
                        )}
                      </form.Field>
                    </>
                  )}
                  <form.Field name={`meetings[${i}].allDay`}>
                    {(field) => (
                      <div className={styles.wide}>
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
      )}

      <form.Field name="bibliography">
        {(field) => (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{tc('materials')}</legend>
            <CardList
              kind={materials}
              rows={field.state.value}
              onChange={field.handleChange}
              newKey={keyOf}
            />
          </fieldset>
        )}
      </form.Field>

      <form.Field name="activities">
        {(field) => (
          <fieldset className={styles.group}>
            <legend className={styles.legend}>{tc('activities')}</legend>
            <CardList
              kind={activities}
              rows={field.state.value}
              onChange={field.handleChange}
              newKey={keyOf}
            />
          </fieldset>
        )}
      </form.Field>

      <form.Field name="cancelled">
        {(field) => (
          <Checkbox
            label={t('cancelled')}
            checked={field.state.value}
            onCheckedChange={(on) => field.handleChange(on === true)}
          />
        )}
      </form.Field>

      <div className={styles.foot}>
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
        <Button type="submit" loading={submitting} disabled={deleted}>
          {t(stage ? 'apply' : 'save')}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t('cancel')}
        </Button>
        <hr className={styles.footRule} />
        <HoldToConfirm
          tone="danger"
          className={styles.hold}
          label={t('holdDelete')}
          confirmedLabel={t('deleted')}
          hint={(seconds) => t('holdHint', { seconds })}
          confirmed={deleted}
          disabled={submitting}
          onConfirm={() => void removeSession()}
        />
      </div>
      {leaving.dialog}
    </form>
  )
}
