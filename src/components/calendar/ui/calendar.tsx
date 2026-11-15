'use client'

import { Collapsible, CollapsiblePanel } from '@ui-sdk/react/collapsible'
import { createMenuController } from '@ui-sdk/react/menu'
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import { BlockMenu, type BlockAction, type BlockMenuEntry } from './block-menu'
import { blockNamer, longDay } from './block-names'
import { allDayBlocks, blocksOf, hourRange, legendOf, timedBlocks } from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { CalendarToolbar } from './calendar-toolbar'
import { CalendarPanel } from './calendar-panel'
import { addDays, cairoNow, formatDay, formatMonths, weekOf, weekStartOf } from './calendar-time'
import styles from './calendar.module.css'
import { SaveBar } from './save-bar'
import { UnscheduledTray } from './unscheduled-tray'
import { useEditSession } from './use-edit-session'
import { useNarrow } from './use-narrow'
import { useNow } from './use-now'
import { WeekGrid } from './week-grid'
import { WeekSpans } from './week-spans'

type Shared = {
  items: CalendarItem[]
  labels: CalendarLabels
  locale: string
  /** The Cairo day to open on: its week, and that day where one day shows at a time. Today by default. */
  day?: string
  /** Ids of the items to mark as changed, in words and on their face. */
  marked?: ReadonlySet<string>
  /** A block was chosen. `blockId` is null for an item with no block. */
  onOpen: (itemId: string, blockId: string | null) => void
  /** The host's name for the days shown, such as the course week "Week 3 of 8"; null for none. */
  weekLabel?: (days: string[]) => string | null
  /** The host's own toolbar buttons, such as Edit. */
  action?: ReactNode
}

export type CalendarProps = Shared &
  (
    | {
        mode: 'view'
        onSave?: undefined
        newItemKind?: undefined
        onUnsavedChange?: undefined
        onSaveIntent?: undefined
      }
    | {
        mode: 'edit'
        /**
         * Gets every change at once. Reject to keep them and show why; reject
         * with a `CalendarSaveRefusal` to also offer its way out. Return the
         * items as saved to show them, with their new versions.
         */
        onSave: (
          changes: CalendarChange[],
        ) => void | CalendarItem[] | Promise<void | CalendarItem[]>
        /** What an item made on the page becomes. Without it, nothing can be drawn or copied. */
        newItemKind?: string
        /**
         * How many changes wait for a Save, each time that changes, and 0 when
         * the calendar leaves the page. A host warns before leaving while it is above 0.
         */
        onUnsavedChange?: (count: number) => void
        /** The pointer or focus reached Save, so the host can load what a save shows next. */
        onSaveIntent?: () => void
      }
  )

const STEP = 15
const NO_MARKS: ReadonlySet<string> = new Set()
const indexOfDay = (days: string[], day: string) => Math.max(0, days.indexOf(day))

export function Calendar({
  items,
  labels,
  locale,
  day,
  marked = NO_MARKS,
  onOpen,
  weekLabel,
  action,
  mode,
  onSave,
  newItemKind,
  onUnsavedChange,
  onSaveIntent,
}: CalendarProps) {
  const editable = mode === 'edit'
  const frame = useRef<HTMLDivElement>(null)
  const hintId = useId()
  const narrow = useNarrow(frame)
  const now = useNow()
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menu] = useState(() => createMenuController<string>())
  const [told, setTold] = useState('')
  const menuTarget = useRef<string | null>(null)

  const [start, setStart] = useState(() => weekStartOf(day ?? cairoNow().date))
  const [selectedIndex, setSelectedIndex] = useState(() =>
    indexOfDay(weekOf(start), day ?? cairoNow().date),
  )
  const days = useMemo(() => weekOf(start), [start])
  const todayIndex = now ? days.indexOf(now.date) : -1

  const goTo = (next: string) => {
    setStart(next)
    setSelectedIndex(indexOfDay(weekOf(next), cairoNow().date))
  }

  const loaded = useMemo(() => timedBlocks(blocksOf(items)), [items])
  // Edit mode shows the same hours in every week, so a drag never moves the grid.
  const range = useMemo(
    () =>
      editable
        ? hourRange('edit', loaded)
        : hourRange(
            'view',
            loaded.filter((block) => days.includes(block.track)),
          ),
    [editable, loaded, days],
  )

  const session = useEditSession({
    items,
    newItemKind,
    onSave,
    scope: frame,
    range,
  })

  const unsavedCount = useRef(onUnsavedChange)
  useEffect(() => {
    unsavedCount.current = onUnsavedChange
  })
  useEffect(() => {
    unsavedCount.current?.(session.changes.length)
  }, [session.changes.length])
  useEffect(
    () => () => {
      unsavedCount.current?.(0)
    },
    [],
  )

  const allDay = useMemo(() => allDayBlocks(session.working, days), [session.working, days])
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
  const anyMarked = session.items.some((item) => marked.has(item.id))

  const droppedNote = session.dropped.length ? labels.dropped(session.dropped.join(', ')) : ''

  const rangeLabel = labels.range(
    formatDay(days[0]!, locale, { day: 'numeric', month: 'short' }),
    formatDay(days[6]!, locale, { day: 'numeric', month: 'short', year: 'numeric' }),
  )

  const nameOf = useMemo(
    () =>
      blockNamer({
        items: session.items,
        labels,
        locale,
        unsaved: session.unsaved,
        marked,
      }),
    [session.items, labels, locale, session.unsaved, marked],
  )

  const blockMenu = labels.menu
  const entriesOf = (blockId: string): BlockMenuEntry[] => {
    const block = session.working.find((candidate) => candidate.id === blockId)
    if (!block) return []
    const entries: BlockMenuEntry[] = [{ action: 'open', disabled: !itemIds.has(block.itemId) }]
    if (editable && !block.readOnly) {
      entries.push({ action: 'add-next-day' })
      if (newItemKind) entries.push({ action: 'copy-next-week' })
      entries.push({ action: 'delete' })
    }
    return entries
  }

  const runBlockAction = (action: BlockAction, blockId: string) => {
    const block = session.working.find((candidate) => candidate.id === blockId)
    if (!block || !blockMenu) return
    menuTarget.current = blockId
    setTold('')
    switch (action) {
      case 'open':
        // The host puts focus back on the block when its dialog closes, so the block has it now.
        session.focusable({ id: blockId, track: block.track })?.focus()
        onOpen(block.itemId, block.blockId)
        break
      case 'add-next-day': {
        const copy = session.addNextDay(blockId)
        if (copy) {
          menuTarget.current = copy.id
          setTold(blockMenu.addedNextDay(longDay(copy.track, locale)))
        }
        break
      }
      case 'copy-next-week': {
        const [first] = session
          .copyNextWeek(blockId)
          .toSorted((a, b) => a.track.localeCompare(b.track))
        if (first) setTold(blockMenu.copiedNextWeek(longDay(first.track, locale)))
        break
      }
      case 'delete':
        session.removeBlock(blockId)
        break
    }
  }

  const menuFocus = () => {
    const wanted = menuTarget.current ?? menu.getPayload() ?? null
    menuTarget.current = null
    const block = session.working.find((candidate) => candidate.id === wanted)
    return wanted && block ? session.focusable({ id: wanted, track: block.track }) : null
  }

  return (
    <div className={styles.root} role="group" aria-label={labels.name}>
      <WeekSpans.Root
        ref={frame}
        className={styles.frame}
        data-mode={mode}
        onPointerDown={(event) => {
          if (!(event.target as Element).closest('[data-span-id]')) setSelectedId(null)
        }}
        spans={session.timed}
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
          const more = (event?.target as Element | null | undefined)?.closest('[data-block-menu]')
          if (more) return void menu.open({ payload: block.id, anchor: more })
          const touch = (event as PointerEvent | undefined)?.pointerType === 'touch'
          // A first tap selects, to show the handles; a block with none opens at once.
          if (editable && !block.readOnly && touch && selectedId !== block.id)
            return setSelectedId(block.id)
          if (itemIds.has(block.itemId)) onOpen(block.itemId, block.blockId)
        }}
      >
        <Collapsible
          className={styles.layout}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          data-panel={panelOpen ? '' : undefined}
        >
          <CalendarToolbar
            labels={labels}
            months={formatMonths(days[0]!, days[6]!, locale)}
            week={weekLabel?.(days) ?? null}
            range={rangeLabel}
            action={action}
            onCreate={
              editable && newItemKind ? () => session.drawOnDay(days[selectedIndex]!) : undefined
            }
            onPrevious={() => goTo(addDays(start, -7))}
            onNext={() => goTo(addDays(start, 7))}
            onToday={() => goTo(weekStartOf(cairoNow().date))}
          />

          <div className={styles.main}>
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
              editable={editable}
              unsaved={session.unsaved}
              marked={marked}
              selectedId={selectedId}
              nameOf={nameOf}
              newTone={newTone}
              onDraw={newItemKind ? session.drawOnDay : undefined}
              menu={blockMenu ? menu : undefined}
              hintId={hintId}
              onOpen={onOpen}
              onRestore={session.restore}
              onDelete={session.removeBlock}
            />
          </div>

          <CollapsiblePanel className={styles.panel}>
            <CalendarPanel
              items={session.items}
              labels={labels}
              locale={locale}
              now={now}
              onOpen={onOpen}
            >
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
                  {anyMarked ? (
                    <li data-tone="neutral">
                      <span className={styles.swatch} data-marked aria-hidden />
                      {labels.changed}
                    </li>
                  ) : null}
                </ul>
              ) : null}

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
            </CalendarPanel>
          </CollapsiblePanel>
        </Collapsible>

        <p role="status" className={styles.srOnly}>
          {droppedNote}
          {told}
          {session.changes.length ? ` ${labels.changes(session.changes.length)}` : ''}
        </p>

        {blockMenu ? (
          <BlockMenu
            controller={menu}
            labels={blockMenu}
            titleOf={(blockId) => {
              const block = session.working.find((candidate) => candidate.id === blockId)
              return (
                session.items.find((item) => item.id === block?.itemId)?.title ?? labels.newItem
              )
            }}
            entriesOf={entriesOf}
            onAction={runBlockAction}
            finalFocus={menuFocus}
          />
        ) : null}

        {editable && (session.changes.length || session.error || droppedNote) ? (
          <SaveBar
            labels={labels}
            count={session.changes.length}
            saving={session.saving}
            error={session.error}
            note={[droppedNote, session.changes.length ? told : ''].filter(Boolean).join(' ')}
            onSave={session.save}
            onSaveIntent={onSaveIntent}
            onCancel={session.cancel}
            onDiscard={session.cancel}
            onDismiss={session.dismissDropped}
          />
        ) : null}
      </WeekSpans.Root>
    </div>
  )
}
