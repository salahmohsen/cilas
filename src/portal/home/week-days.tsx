'use client'

import Link from 'next/link'
import { useState, useSyncExternalStore } from 'react'

import { ToggleStrip } from '@/components/sdk/toggle-strip'
import { cairoDay } from '@/lib/cairo-day'
import { announce } from '@/portal/feedback/announce'

import styles from './home.module.css'
import { WEEK_HEADING_ID } from './week'

export type RowView = {
  key: string
  href: string
  time: string
  dateTime: string
  title: string
  context: string | null
  place: string | null
}

export type DayView = {
  date: string
  weekday: string
  number: string
  count: number
  countLabel: string
  listLabel: string
  empty: string
  rows: RowView[]
}

const MOST_DOTS = 3

const onReturn = (changed: () => void) => {
  document.addEventListener('visibilitychange', changed)
  return () => document.removeEventListener('visibilitychange', changed)
}

const cairoToday = () => cairoDay(new Date())!

// WARNING: keep the name one string. A browser can add a space between separate spans, so the name would not match the label.
function DayCell({ day }: { day: DayView }) {
  return (
    <>
      <span className={styles.dayName} aria-hidden="true">
        {day.weekday}
      </span>
      <span className={styles.dayNumber} aria-hidden="true">
        {day.number}
      </span>
      <span className={styles.dayDots} aria-hidden="true" data-week-count={day.count}>
        {Array.from({ length: Math.min(day.count, MOST_DOTS) }, (_, dot) => (
          <span key={dot} />
        ))}
      </span>
      <span className="sr-only">{`${day.weekday} ${day.number}${day.countLabel}`}</span>
    </>
  )
}

export function WeekDays({ days, today }: { days: DayView[]; today: string }) {
  const now = useSyncExternalStore(onReturn, cairoToday, () => today)
  const [chosen, setChosen] = useState<string | null>(null)
  const dayOn = (date: string | null) => days.find((day) => day.date === date)
  const shown = dayOn(chosen) ?? dayOn(now) ?? dayOn(today)!

  const choose = (date: string) => {
    setChosen(date)
    const day = dayOn(date)!
    announce(`${day.listLabel}${day.countLabel}`)
  }

  return (
    <>
      <ToggleStrip
        labelledBy={WEEK_HEADING_ID}
        className={styles.weekDays}
        value={shown.date}
        onValueChange={choose}
        items={days.map((day) => ({
          value: day.date,
          current: day.date === now ? ('date' as const) : undefined,
          content: <DayCell day={day} />,
        }))}
      />
      {shown.rows.length ? (
        <ul className={styles.weekRows} aria-label={shown.listLabel}>
          {shown.rows.map((row) => (
            <li key={row.key}>
              <Link href={row.href} className={styles.weekRow}>
                <time className={styles.weekTime} dateTime={row.dateTime}>
                  {row.time}
                </time>{' '}
                <span className={styles.weekCopy}>
                  <span className={styles.weekTitle}>
                    <bdi>{row.title}</bdi>
                  </span>{' '}
                  {row.context && (
                    <span className={styles.weekMeta}>
                      <bdi>{row.context}</bdi>
                    </span>
                  )}{' '}
                  {row.place && (
                    <span className={styles.weekMeta}>
                      <bdi>{row.place}</bdi>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.empty}>{shown.empty}</p>
      )}
    </>
  )
}
