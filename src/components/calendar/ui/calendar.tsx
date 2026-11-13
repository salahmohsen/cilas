'use client'

import { useId, useMemo, useRef, useState } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import { blockNamer } from './block-names'
import { allDayBlocks, hourRange, legendOf, timedBlocks } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { CalendarToolbar } from './calendar-toolbar'
import { addDays, cairoNow, formatDay, weekOf, weekStartOf } from './calendar-time'
import styles from './calendar.module.css'
import { SaveBar } from './save-bar'
import { UnscheduledTray } from './unscheduled-tray'
import { useEditSession } from './use-edit-session'
import { useHour12 } from './use-hour12'
import { useNarrow } from './use-narrow'
import { useNow } from './use-now'
import { WeekGrid } from './week-grid'
import { WeekSpans } from './week-spans'

type Shared = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  /** Any Cairo day of the week to open on; today by default. */
  day?: string
  /** A block was chosen. `blockId` is null for an item with no block. */
  onOpen: (itemId: string, blockId: string | null) => void
}

export type CalendarProps = Shared &
  (
    | { mode: 'view'; onSave?: undefined; newItemKind?: undefined }
    | {
        mode: 'edit'
        /**
         * Gets every change at once. Reject to keep them and show why. Return
         * the items as saved to show them, with their new versions.
         */
        onSave: (
          changes: CalendarChange[],
        ) => void | CalendarItem[] | Promise<void | CalendarItem[]>
        /** What a block drawn on an empty slot becomes. Without it, nothing can be drawn. */
        newItemKind?: string
      }
  )

const STEP = 15
const indexOfDay = (days: string[], day: string) => Math.max(0, days.indexOf(day))

export function Calendar({
  items,
  labels,
  locale,
  day,
  onOpen,
  mode,
  onSave,
  newItemKind,
}: CalendarProps) {
  const editable = mode === 'edit'
  const frame = useRef<HTMLDivElement>(null)
  const hintId = useId()
  const narrow = useNarrow(frame)
  const now = useNow()
  const [hour12, setHour12] = useHour12()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const [start, setStart] = useState(() => weekStartOf(day ?? cairoNow().date))
  const [selectedIndex, setSelectedIndex] = useState(() =>
    indexOfDay(weekOf(start), cairoNow().date),
  )
  const days = useMemo(() => weekOf(start), [start])
  const todayIndex = now ? days.indexOf(now.date) : -1

  const goTo = (next: string) => {
    setStart(next)
    setSelectedIndex(indexOfDay(weekOf(next), cairoNow().date))
  }

  // Edit mode keeps the hours it opened with, from an hour before the earliest
  // meeting to an hour after the latest, so a drag never moves the grid.
  const [editHours, setEditHours] = useState<{ min: number; max: number } | null>(null)
  if (editable && !editHours) setEditHours(hourRange(timedBlocks(items), 1))
  if (!editable && editHours) setEditHours(null)

  const loaded = useMemo(() => timedBlocks(items), [items])
  const range = useMemo(
    () => editHours ?? hourRange(loaded.filter((block) => days.includes(block.track))),
    [editHours, loaded, days],
  )

  const session = useEditSession({
    items,
    newItemKind,
    onSave,
    scope: frame,
    range,
  })

  const allDay = useMemo(() => allDayBlocks(session.items, days), [session.items, days])
  const legend = useMemo(() => legendOf(session.items), [session.items])
  // A block of an item made on the page has nothing to open until it is saved.
  const itemIds = useMemo(() => new Set(session.items.map((item) => item.id)), [session.items])
  const newTone = legend.find((entry) => entry.kind === newItemKind)?.tone ?? 'neutral'
  const placedIds = new Set(
    session.working.flatMap((block) => (block.deleted ? [] : [block.itemId])),
  )
  const unscheduled = session.items.filter(
    (item) => item.blocks.length === 0 && !placedIds.has(item.id),
  )
  const anyCancelled = session.items.some((item) => item.cancelled)

  const rangeLabel = labels.range(
    formatDay(days[0]!, locale, { day: 'numeric', month: 'short' }),
    formatDay(days[6]!, locale, { day: 'numeric', month: 'short', year: 'numeric' }),
  )

  const nameOf = useMemo(
    () => blockNamer({ items: session.items, labels, locale, hour12, unsaved: session.unsaved }),
    [session.items, labels, locale, hour12, session.unsaved],
  )

  return (
    <div className={styles.root} role="group" aria-label={labels.name}>
      <WeekSpans.Root
        ref={frame}
        className={styles.frame}
        data-mode={mode}
        onPointerDown={(event) => {
          if (!(event.target as Element).closest('[data-span-id]')) setSelectedId(null)
        }}
        spans={session.working}
        onSpansChange={session.onSpansChange}
        editable={editable}
        tracks={narrow ? [days[selectedIndex]!] : days}
        min={range.min}
        max={range.max}
        step={STEP}
        create={session.draw}
        label={nameOf}
        message={({ type, label }) => labels.announce(type, label)}
        onPress={(block, event) => {
          if (block.deleted) return session.restore(block.id)
          const touch = (event as PointerEvent | undefined)?.pointerType === 'touch'
          if (editable && touch && selectedId !== block.id) return setSelectedId(block.id)
          if (itemIds.has(block.itemId)) onOpen(block.itemId, block.blockId)
        }}
      >
        <CalendarToolbar
          labels={labels}
          range={rangeLabel}
          hour12={hour12}
          onHour12={setHour12}
          onPrevious={() => goTo(addDays(start, -7))}
          onNext={() => goTo(addDays(start, 7))}
          onToday={() => goTo(weekStartOf(cairoNow().date))}
        />

        {legend.length ? (
          <ul className={styles.legend} aria-label={labels.legend}>
            {legend.map(({ kind, tone }) => (
              <li key={kind} data-tone={tone}>
                <span className={styles.swatch} aria-hidden />
                {labels.kind(kind)}
              </li>
            ))}
            {anyCancelled ? (
              <li data-tone="neutral">
                <span className={styles.swatch} data-cancelled aria-hidden />
                {labels.cancelled}
              </li>
            ) : null}
          </ul>
        ) : null}

        {editable ? (
          <p className={styles.hint} id={hintId}>
            {labels.editHint}
          </p>
        ) : null}

        <div className={styles.switcher}>
          <SegmentedControl
            label={labels.daySwitcher}
            value={String(selectedIndex)}
            onValueChange={(value) => setSelectedIndex(Number(value))}
            options={days.map((date, index) => ({
              value: String(index),
              label: `${formatDay(date, locale, { weekday: 'short' })} ${formatDay(date, locale, { day: 'numeric' })}`,
            }))}
          />
        </div>

        <WeekGrid
          items={session.items}
          allDay={allDay}
          days={days}
          range={range}
          selectedIndex={selectedIndex}
          todayIndex={todayIndex}
          now={now}
          labels={labels}
          locale={locale}
          hour12={hour12}
          editable={editable}
          unsaved={session.unsaved}
          selectedId={selectedId}
          nameOf={nameOf}
          newTone={newTone}
          onDraw={newItemKind ? session.drawOnDay : undefined}
          hintId={hintId}
          onOpen={onOpen}
        />

        {unscheduled.length ? (
          <UnscheduledTray
            items={unscheduled}
            days={days}
            editable={editable}
            labels={labels}
            locale={locale}
            onOpen={onOpen}
            onPlace={session.place}
          />
        ) : null}

        <p role="status" className={styles.srOnly}>
          {session.changes.length ? labels.changes(session.changes.length) : ''}
        </p>

        {editable && (session.changes.length || session.error) ? (
          <SaveBar
            labels={labels}
            count={session.changes.length}
            saving={session.saving}
            error={session.error}
            onSave={session.save}
            onCancel={session.cancel}
          />
        ) : null}
      </WeekSpans.Root>
    </div>
  )
}
