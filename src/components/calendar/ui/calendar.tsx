'use client'

import { Collapsible, CollapsiblePanel } from '@ui-sdk/react/collapsible'
import { createMenuController } from '@ui-sdk/react/menu'
import { createPopoverController } from '@ui-sdk/react/popover'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import { BlockDetails, type CalendarAction, type DetailsTarget } from './block-details'
import { BlockMenu, type BlockAction, type BlockMenuEntry } from './block-menu'
import { blockNamer, longDay } from './block-names'
import {
  allDayBars,
  blocksOf,
  hourRange,
  legendOf,
  timedBlocks,
  type EditBlock,
} from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { CalendarToolbar } from './calendar-toolbar'
import { CalendarPanel } from './calendar-panel'
import { AgendaList } from './agenda-list'
import { cairoNow, formatDay, formatMonths, weekOf, weekStartOf } from './calendar-time'
import { daysOf, stepFrom, viewAt, viewsAt, type CalendarView } from './calendar-views'
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
  /** The view to open in, where the width has it. Without it: the week, and one day on a phone. */
  view?: CalendarView
  /** Ids of the items to mark as changed, in words and on their face. */
  marked?: ReadonlySet<string>
  /**
   * Opens an item: in edit mode, or from an action, a press on its block.
   * `blockId` is null for an item with no block.
   */
  onOpen: (itemId: string, blockId: string | null) => void
  /**
   * The actions in an item's details. With it, a press in view mode opens
   * the details at the block (a sheet on a narrow calendar); without it, a
   * press opens the item at once.
   */
  actionsOf?: (item: CalendarItem) => CalendarAction[]
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
/** The details' width (22rem) and gap, which must fit beside a block; else they open below it. */
const DETAILS_ROOM = 22 * 16 + 20
const besideFits = (anchor: HTMLElement) => {
  const { left, right } = anchor.getBoundingClientRect()
  return Math.max(left, document.documentElement.clientWidth - right) >= DETAILS_ROOM
}
const NO_MARKS: ReadonlySet<string> = new Set()
const indexOfDay = (days: string[], day: string) => Math.max(0, days.indexOf(day))
const longDate = { day: 'numeric', month: 'short', year: 'numeric' } as const

export function Calendar({
  items,
  labels,
  locale,
  day,
  view: startView = 'week',
  marked = NO_MARKS,
  onOpen,
  actionsOf,
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
  const narrow = useNarrow(frame)
  const now = useNow()
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [menu] = useState(() => createMenuController<string>())
  const [details] = useState(() => createPopoverController<DetailsTarget>())
  const [detailsSide, setDetailsSide] = useState<'end' | 'bottom'>('end')
  const [told, setTold] = useState('')
  const menuTarget = useRef<string | null>(null)

  // The day the view is about: the Day view's day, the first of 3 days, a day in the week.
  const [anchor, setAnchor] = useState(() => day ?? cairoNow().date)
  const [wanted, setWanted] = useState<CalendarView>(startView)
  // Before the width is known (the server's render) the wide view shows, and
  // the stylesheet shows its anchor day alone on a phone, as the Day view does.
  const shown = viewAt(wanted, narrow ?? false)
  const grid = shown.layout === 'grid'
  const days = useMemo(() => daysOf(shown.span, anchor), [shown.span, anchor])
  // The anchor's week sets the hours, the course week and the scroll target,
  // so they stay the same between the week, its days and a phone's first render.
  const week = useMemo(() => weekOf(weekStartOf(anchor)), [anchor])
  const selectedIndex = indexOfDay(days, anchor)
  const todayIndex = now ? days.indexOf(now.date) : -1

  const loaded = useMemo(() => timedBlocks(blocksOf(items)), [items])
  // Edit mode shows the same hours in every week, so a drag never moves the grid.
  const range = useMemo(
    () =>
      editable
        ? hourRange('edit', loaded)
        : hourRange(
            'view',
            loaded.filter((block) => week.includes(block.track) || days.includes(block.track)),
          ),
    [editable, loaded, week, days],
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

  const bars = useMemo(
    () =>
      allDayBars(session.working, days, (block) =>
        block.deleted ? 'deleted' : session.unsaved.has(block.id) ? 'unsaved' : 'saved',
      ),
    [session.working, session.unsaved, days],
  )
  /** The blocks a block stands for: all the days of its all-day bar, or itself. */
  const runOf = (blockId: string) =>
    bars.find((bar) => bar.blocks[0].id === blockId)?.blocks ??
    session.working.filter((block) => block.id === blockId)
  // In reverse, so focus ends on the bar's first block, which names it.
  const removeRun = (blockId: string) =>
    runOf(blockId)
      .toReversed()
      .forEach((block) => session.removeBlock(block.id))
  const restoreRun = (blockId: string) =>
    runOf(blockId)
      .toReversed()
      .forEach((block) => session.restore(block.id))
  const legend = useMemo(() => legendOf(session.items), [session.items])
  // A block of an item made on the page has nothing to open until it is saved.
  const itemIds = useMemo(() => new Set(session.items.map((item) => item.id)), [session.items])
  /** A press on a block, a bar, an agenda row or an unscheduled item: its details, or the item itself. */
  const press = (itemId: string, blocks: EditBlock[], anchor: HTMLElement) => {
    if (!itemIds.has(itemId)) return
    if (editable || !actionsOf) return onOpen(itemId, blocks[0]?.blockId ?? null)
    setDetailsSide(besideFits(anchor) ? 'end' : 'bottom')
    void details.open({ payload: { itemId, blocks, anchor }, anchor })
  }
  const pressBlock = (itemId: string, blockId: string | null, anchor: HTMLElement) =>
    press(
      itemId,
      session.working.filter((block) => block.itemId === itemId && block.blockId === blockId),
      anchor,
    )
  const runAction = (action: CalendarAction, { itemId, blocks, anchor }: DetailsTarget) => {
    details.close()
    // The host's dialog gives focus back to what had it when it opened: the block.
    if (anchor.isConnected) anchor.focus()
    action.run(itemId, blocks[0]?.blockId ?? null)
  }

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

  const first = days[0]!
  const last = days.at(-1)!
  const rangeLabel =
    first === last
      ? formatDay(first, locale, { weekday: 'long', ...longDate })
      : labels.range(
          formatDay(first, locale, { day: 'numeric', month: 'short' }),
          formatDay(last, locale, longDate),
        )
  const count = shown.span === 'twoWeeks' ? 2 : days.length

  const viewSwitch = (atNarrow: boolean) => (
    <SegmentedControl
      label={labels.view}
      value={viewAt(wanted, atNarrow).id}
      onValueChange={(value) => setWanted(value as CalendarView)}
      options={viewsAt(atNarrow).map((row) => ({
        value: row.id,
        label: labels.viewName(row.id, daysOf(row.span, anchor).length),
      }))}
    />
  )
  // The server cannot know the width: it sends both switches, and the stylesheet shows one.
  const views =
    narrow === null ? (
      <>
        <div className={styles.views} data-width="wide">
          {viewSwitch(false)}
        </div>
        <div className={styles.views} data-width="narrow">
          {viewSwitch(true)}
        </div>
      </>
    ) : (
      <div className={styles.views}>{viewSwitch(narrow)}</div>
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
        const copy = session.addNextDay(runOf(blockId).at(-1)!.id)
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
        removeRun(blockId)
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
        tracks={grid ? days : []}
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
          const anchor = session.focusable({ id: block.id, track: block.track })
          if (anchor) press(block.itemId, [block], anchor)
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
            months={formatMonths(first, last, locale)}
            week={weekLabel?.(week) ?? null}
            range={rangeLabel}
            previousLabel={labels.previous(shown.span, count)}
            nextLabel={labels.next(shown.span, count)}
            views={views}
            action={action}
            onCreate={
              editable && newItemKind
                ? () => {
                    // The agenda moves nothing, so a new item is drawn on its day's grid.
                    if (!grid) setWanted('day')
                    session.drawOnDay(anchor)
                  }
                : undefined
            }
            onPrevious={() => setAnchor(stepFrom(shown.span, anchor, -1))}
            onNext={() => setAnchor(stepFrom(shown.span, anchor, 1))}
            onToday={() => setAnchor(cairoNow().date)}
          />

          <div className={styles.main}>
            {editable && unscheduled.length ? (
              <div className={styles.editTray}>
                <UnscheduledTray
                  items={unscheduled}
                  days={grid ? days : week}
                  editable
                  labels={labels}
                  locale={locale}
                  onOpen={(itemId, anchor) => press(itemId, [], anchor)}
                  onPlace={session.place}
                />
              </div>
            ) : null}

            {grid ? (
              <WeekGrid
                view={shown.id}
                week={week}
                items={session.items}
                bars={bars}
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
                onPress={press}
                onRestore={restoreRun}
                onDelete={removeRun}
              />
            ) : (
              <AgendaList
                items={session.items}
                blocks={session.working}
                days={days}
                today={now?.date ?? null}
                labels={labels}
                locale={locale}
                unsaved={session.unsaved}
                marked={marked}
                nameOf={nameOf}
                newTone={newTone}
                empty={labels.nothing(shown.span, count)}
                onPress={press}
                onRestore={session.restore}
              />
            )}
          </div>

          <CollapsiblePanel className={styles.panel}>
            <CalendarPanel
              items={session.items}
              labels={labels}
              locale={locale}
              now={now}
              onOpen={pressBlock}
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

              {!editable && unscheduled.length ? (
                <UnscheduledTray
                  items={unscheduled}
                  days={grid ? days : week}
                  editable={editable}
                  labels={labels}
                  locale={locale}
                  onOpen={(itemId, anchor) => press(itemId, [], anchor)}
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

        {actionsOf && !editable ? (
          <BlockDetails
            controller={details}
            items={session.items}
            labels={labels}
            locale={locale}
            sheet={narrow ?? false}
            side={detailsSide}
            actionsOf={actionsOf}
            onAction={runAction}
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
