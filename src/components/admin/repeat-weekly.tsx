'use client'

import {
  useConfig,
  useDocumentInfo,
  useForm,
  useFormFields,
  useFormModified,
  useLocale,
} from '@payloadcms/ui'
import { useId, useMemo, useRef, useState } from 'react'

import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import type { CalendarChange } from '@/lib/calendar-items'
import { MAX_REPEATS, weeklyRepeats, type Meeting } from '@/lib/meetings'

import {
  calendarAdminText,
  type AdminLanguage,
  type CalendarAdminMessages,
} from './calendar-admin-text'
import styles from './repeat-weekly.module.css'

type Props = { language: AdminLanguage; messages: CalendarAdminMessages }

type Mode = 'meetings' | 'sessions'

/** What the tool reads of the saved session: the form may hold edits that are not saved. */
type SavedSession = {
  course: number | { id: number }
  updatedAt: string
  meetings?: (Meeting & { id?: string | null })[] | null
}

/**
 * "Repeat weekly" in a session's form: the next N weekly meetings of this
 * session, or N new sessions, each with one meeting at the same weekday and
 * times as the session's last meeting. It saves through `saveCalendarChanges`
 * like the calendar does, so access and the transaction apply, and so it
 * starts from the saved meetings, not from edits still in the form.
 */
export function RepeatWeekly({ language, messages }: Props) {
  const { t, errorText } = useMemo(
    () => calendarAdminText(language, messages),
    [language, messages],
  )
  const { id } = useDocumentInfo()
  const { code: locale } = useLocale()
  const { config } = useConfig()
  const { reset } = useForm()
  const modified = useFormModified()
  const meetingRows = useFormFields(([fields]) => fields.meetings?.rows?.length ?? 0)

  const ids = { count: useId(), problem: useId(), status: useId() }
  const countInput = useRef<HTMLInputElement>(null)
  const [count, setCount] = useState('4')
  const [mode, setMode] = useState<Mode>('meetings')
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (!id) return <p className={styles.note}>{t('repeat.newSession')}</p>

  const fetchSession = async (): Promise<SavedSession> => {
    const url = `${config.routes.api}/sessions/${id}?depth=0&draft=false&locale=${locale}&fallback-locale=none`
    const response = await fetch(url, { credentials: 'include' })
    if (!response.ok) throw new Error(t('errors.failed'))
    return response.json()
  }

  const fail = (message: string, field?: boolean) => {
    setProblem(message)
    if (field) countInput.current?.focus()
  }

  const repeat = async () => {
    const n = Number(count)
    setDone(null)
    if (!Number.isInteger(n) || n < 1 || n > MAX_REPEATS)
      return fail(t('repeat.countInvalid', { max: MAX_REPEATS }), true)
    setProblem(null)
    setBusy(true)
    try {
      const session = await fetchSession()
      const next = weeklyRepeats(session.meetings ?? [], n)
      if (next.length === 0) return fail(t('repeat.needMeeting'))

      const changes: CalendarChange[] = next.map((meeting, i) => {
        const when = {
          date: meeting.date,
          start_time: meeting.start_time ?? null,
          end_time: meeting.end_time ?? null,
        }
        return mode === 'meetings'
          ? {
              op: 'add-block',
              itemId: String(id),
              version: session.updatedAt,
              blockId: `repeat-${i}`,
              ...when,
            }
          : { op: 'create-item', kind: 'session', blockId: `repeat-${i}`, ...when }
      })
      const course = typeof session.course === 'object' ? session.course.id : session.course
      const result = await saveCalendarChanges(
        { parent: { kind: 'course', id: String(course) }, changes },
        locale,
      )
      if (!result.ok) return fail(errorText(result.error))

      // The form still shows the meetings it loaded; load the saved ones into it.
      if (mode === 'meetings') await reset(await fetchSession())
      setDone(t(mode === 'meetings' ? 'repeat.doneMeetings' : 'repeat.doneSessions', { count: n }))
    } catch (error) {
      fail(error instanceof Error ? error.message : t('errors.failed'))
    } finally {
      setBusy(false)
    }
  }

  const blocked = modified
    ? t('repeat.saveFirst')
    : meetingRows === 0
      ? t('repeat.needMeeting')
      : null

  return (
    <fieldset className={styles.root} aria-describedby={ids.status}>
      <legend className={styles.legend}>{t('repeat.legend')}</legend>
      <p className={styles.note}>{t('repeat.hint')}</p>

      <div className={styles.row}>
        <label htmlFor={ids.count}>{t('repeat.count')}</label>
        <input
          ref={countInput}
          id={ids.count}
          className={styles.count}
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_REPEATS}
          value={count}
          aria-invalid={problem !== null && done === null ? true : undefined}
          aria-describedby={problem ? ids.problem : undefined}
          onChange={(event) => setCount(event.target.value)}
          // Enter must not submit the session's own form.
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            if (!blocked) void repeat()
          }}
        />
      </div>

      <div className={styles.modes} role="radiogroup" aria-label={t('repeat.legend')}>
        {(['meetings', 'sessions'] as const).map((value) => (
          <label key={value} className={styles.mode}>
            <input
              type="radio"
              name={`${ids.count}-mode`}
              checked={mode === value}
              onChange={() => setMode(value)}
            />
            {t(value === 'meetings' ? 'repeat.asMeetings' : 'repeat.asSessions')}
          </label>
        ))}
      </div>

      <div className={styles.row}>
        <button
          type="button"
          className={styles.go}
          disabled={busy || blocked !== null}
          onClick={() => void repeat()}
        >
          {busy ? t('repeat.going') : t('repeat.go')}
        </button>
        {blocked ? <span className={styles.note}>{blocked}</span> : null}
      </div>

      <p id={ids.problem} role="alert" className={styles.problem} hidden={!problem}>
        {problem}
      </p>
      <p id={ids.status} role="status" className={styles.done}>
        {done}
      </p>
    </fieldset>
  )
}
