'use client'

import { Collapsible, CollapsiblePanel } from '@ui-sdk/react/collapsible'
import { createMenuController } from '@ui-sdk/react/menu'
import { createPopoverController } from '@ui-sdk/react/popover'
import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'
import { useNarrow as usePhone } from '@/lib/use-narrow'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import {
  BlockDetails,
  DETAILS_WIDTH,
  type CalendarAction,
  type DetailsTarget,
} from './block-details'
import { BlockMenu, type BlockAction, type BlockMenuEntry } from './block-menu'
import { blockNamer, longDay } from './block-names'
import {
  allDayBars,
  blocksOf,
  editState,
  hourRange,
  legendOf,
  timedBlocks,
  type EditBlock,
} from './calendar-model'
import type { CalendarLabels } from './calendar-labels'
import { CalendarToolbar } from './calendar-toolbar'
import { CalendarPanel } from './calendar-panel'
import { AgendaList } from './agenda-list'
import {
  cairoNow,
  formatDay,
  formatMonths,
  monthWeeksOf,
  weekOf,
  weekStartOf,
  toTime,
} from './calendar-time'
import { daysOf, stepFrom, viewAt, viewsAt, type CalendarView } from './calendar-views'
import styles from './calendar.module.css'
import { pressStays } from './item-press'
import { MonthGrid } from './month-grid'
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
  /**
   * The view and day after the person moves the calendar, for a host that
   * keeps them, as in the URL. With it, a new `view` or `day` from the host
   * moves the calendar; without it, they only set where it opens.
   */
  onNavigate?: (view: CalendarView, day: string) => void
  /** Ids of the items to mark as changed, in words and on their face. */
  marked?: ReadonlySet<string>
  /**
   * Opens an item: in edit mode, or from an action, a press on its block.
   * `blockId` is null for an item with no block.
   */
  onOpen: (itemId: string, blockId: string | null, item?: CalendarItem) => void
  /**
   * The actions in an item's details. With it, a press in view mode opens
   * the details at the block (a sheet on a narrow calendar); without it, a
   * press opens the item at once.
   */
  actionsOf?: (item: CalendarItem) => CalendarAction[]
  // The host holds these changes. null stages removal of the item.
  drafts?: ReadonlyMap<
    string,
    Partial<Pick<CalendarItem, 'title' | 'summary' | 'cancelled'>> | null
  >
  onCancelEdits?: () => void
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
/** Whether the details fit beside a block, with their gap; else they open below it. */
const besideFits = (anchor: HTMLElement) => {
  const { left, right } = anchor.getBoundingClientRect()
  return Math.max(left, document.documentElement.clientWidth - right) >= DETAILS_WIDTH + 20
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
  onNavigate,
  marked = NO_MARKS,
  onOpen,
  actionsOf,
  weekLabel,
  action,
  drafts,
  onCancelEdits,
  mode,
  onSave,
  newItemKind,
  onUnsavedChange,
  onSaveIntent,
}: CalendarProps) {
  const editable = mode === 'edit'
  const frame = useRef<HTMLDivElement>(null)
  const narrow = useNarrow(frame)
  // The details are a sheet on a phone screen, as the site's dialogs are, whatever the calendar's width.
  const phone = usePhone()
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
  // A host that keeps the view and day (it has `onNavigate`) leads: Back in the
  // browser moves the calendar. For other hosts they only set where it opens.
  const [followed, setFollowed] = useState({ day, view: startView })
  if (onNavigate && (followed.day !== day || followed.view !== startView)) {
    setFollowed({ day, view: startView })
    if (day) setAnchor(day)
    setWanted(startView)
  }
  const go = (view: CalendarView, to: string) => {
    setWanted(view)
    setAnchor(to)
    onNavigate?.(view, to)
  }
  // The kinds the legend turned off: their items leave the grid, the agenda and Up next.
  const [hidden, setHidden] = useState<ReadonlySet<string>>(() => new Set())
  // The keyboard turned the month: the new month's grid takes focus on its anchor day, once.
  const [monthFocus, setMonthFocus] = useState(false)
  useEffect(() => {
    if (monthFocus) setMonthFocus(false)
  }, [monthFocus])
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

  // The hours follow what shows: a kind turned off in the legend does not hold them open.
  const loaded = useMemo(
    () => timedBlocks(blocksOf(items.filter((item) => !hidden.has(item.kind)))),
    [items, hidden],
  )
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

  const keepChange = (change: CalendarChange) =>
    !('itemId' in change) || !change.itemId || drafts?.get(change.itemId) !== null
  const edits = useEditSession({
    items,
    newItemKind,
    onSave: onSave ? (changes) => onSave(changes.filter(keepChange)) : undefined,
    scope: frame,
    range,
  })

  const kindOf = useMemo(
    () => new Map(edits.items.map((item) => [item.id, item.kind])),
    [edits.items],
  )
  const visible = (block: EditBlock) =>
    drafts?.get(block.itemId) !== null && !hidden.has(kindOf.get(block.itemId) ?? newItemKind ?? '')
  const session = {
    ...edits,
    items: [
      ...edits.items,
      ...[...new Set(edits.working.map((block) => block.itemId))]
        .filter((id) => !edits.items.some((item) => item.id === id))
        .map((id): CalendarItem => ({
          id,
          kind: newItemKind ?? '',
          title: labels.newItem,
          tone: edits.items[0]?.tone ?? 'neutral',
          cancelled: false,
          version: '',
          blocks: [],
        })),
    ].map((item) => ({
      ...item,
      ...drafts?.get(item.id),
      title: drafts?.has(item.id)
        ? (drafts.get(item.id)?.title ?? item.caption ?? item.title)
        : item.title,
    })),
    working: edits.working.filter(visible),
    timed: edits.timed.filter(visible),
    changes: edits.changes.filter(keepChange),
    unsaved: new Set([
      ...edits.unsaved,
      ...edits.working.filter((block) => drafts?.has(block.itemId)).map((block) => block.id),
    ]),
  }
  const pending =
    session.changes.length +
    [...(drafts?.keys() ?? [])].filter(
      (id) =>
        edits.items.some((item) => item.id === id) ||
        session.working.some((block) => block.itemId === id && !block.deleted),
    ).length
  const cancel = () => {
    edits.cancel()
    onCancelEdits?.()
  }
  const openItem = (id: string, blockId: string | null) => {
    const item = session.items.find((item) => item.id === id) ?? {
      id,
      kind: newItemKind ?? '',
      title: labels.newItem,
      tone: 'neutral' as const,
      cancelled: false,
      version: '',
      blocks: [],
      ...drafts?.get(id),
    }
    if (!editable || item.readOnly) {
      onOpen(id, blockId)
      return
    }
    onOpen(id, blockId, {
      ...item,
      blocks: session.working
        .filter((block) => block.itemId === id && !block.deleted)
        .map((block) => ({
          id: block.blockId,
          date: block.track,
          start_time: block.allDay ? null : toTime(block.start),
          end_time: block.allDay ? null : toTime(block.end),
        })),
    })
  }

  const unsavedCount = useRef(onUnsavedChange)
  useEffect(() => {
    unsavedCount.current = onUnsavedChange
  })
  useEffect(() => {
    unsavedCount.current?.(pending)
  }, [pending])
  useEffect(
    () => () => {
      unsavedCount.current?.(0)
    },
    [],
  )

  const bars = useMemo(
    () => allDayBars(session.working, days, editState(session.unsaved)),
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
    if (!editable && !itemIds.has(itemId)) return
    if (editable || !actionsOf) return openItem(itemId, blocks[0]?.blockId ?? null)
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
    action.run?.(itemId, blocks[0]?.blockId ?? null)
  }

  const newTone = legend.find((entry) => entry.kind === newItemKind)?.tone ?? 'neutral'
  const placedIds = new Set(
    session.working.flatMap((block) => (block.deleted ? [] : [block.itemId])),
  )
  const unscheduled = session.items.filter(
    (item) =>
      item.blocks.length === 0 &&
      !placedIds.has(item.id) &&
      drafts?.get(item.id) !== null &&
      !hidden.has(item.kind),
  )
  const anyCancelled = session.items.some((item) => item.cancelled)
  const anyMarked = session.items.some((item) => marked.has(item.id))

  const droppedNote = session.dropped.length ? labels.dropped(session.dropped.join(', ')) : ''

  const first = days[0]!
  const last = days.at(-1)!
  const monthName = formatMonths(first, last, locale)
  const rangeLabel =
    shown.span === 'month'
      ? monthName
      : first === last
        ? formatDay(first, locale, { weekday: 'long', ...longDate })
        : labels.range(
            formatDay(first, locale, { day: 'numeric', month: 'short' }),
            formatDay(last, locale, longDate),
          )
  const count = shown.span === 'twoWeeks' ? 2 : shown.span === 'month' ? 1 : days.length
  const monthWeeks = useMemo(() => monthWeeksOf(anchor), [anchor])
  const openDay = (day: string) => go('day', day)

  const viewSwitch = (atNarrow: boolean) => (
    <SegmentedControl
      label={labels.view}
      value={viewAt(wanted, atNarrow).id}
      onValueChange={(value) => go(value as CalendarView, anchor)}
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
    const entries: BlockMenuEntry[] = [
      { action: 'open', disabled: !editable && !itemIds.has(block.itemId) },
    ]
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
        openItem(block.itemId, block.blockId)
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

  const monthGrid = (
    <MonthGrid
      key={days[0]}
      days={days}
      weeks={monthWeeks}
      anchor={anchor}
      focusAnchor={monthFocus}
      name={monthName}
      items={session.items}
      blocks={session.working}
      today={now?.date ?? null}
      labels={labels}
      locale={locale}
      unsaved={session.unsaved}
      marked={marked}
      nameOf={nameOf}
      newTone={newTone}
      onPress={press}
      onRestore={(blocks) => blocks.forEach((block) => session.restore(block.id))}
      onOpenDay={openDay}
      pressOpensDay={editable && Boolean(newItemKind)}
      onTurn={(day) => {
        setMonthFocus(true)
        go(wanted, day)
      }}
    />
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
        spans={session.timed}
        onSpansChange={(value, details) =>
          // The grid holds only the blocks that show; the ones hidden stay in the session.
          edits.onSpansChange(
            [...value, ...edits.timed.filter((block) => !visible(block))],
            details,
          )
        }
        editable={editable}
        tracks={grid ? days : []}
        min={range.min}
        max={range.max}
        step={STEP}
        create={session.draw}
        label={nameOf}
        message={({ type, label }) => labels.announce(type, label)}
        onPress={(block, event) => {
          if (!pressStays(event)) return
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
            months={monthName}
            week={shown.span === 'month' ? null : (weekLabel?.(week) ?? null)}
            range={rangeLabel}
            previousLabel={labels.previous(shown.span, count)}
            nextLabel={labels.next(shown.span, count)}
            views={views}
            action={action}
            onCreate={
              editable && newItemKind
                ? () => {
                    // The agenda moves nothing, so a new item is drawn on its day's grid.
                    if (!grid) go('day', anchor)
                    session.drawOnDay(anchor)
                  }
                : undefined
            }
            onPrevious={() => go(wanted, stepFrom(shown.span, anchor, -1))}
            onNext={() => go(wanted, stepFrom(shown.span, anchor, 1))}
            onToday={() => go(wanted, cairoNow().date)}
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
            ) : shown.layout === 'month' ? (
              <>
                <div className={styles.monthWide} data-width="wide">
                  {monthGrid}
                </div>
                {narrow === null ? (
                  // The server cannot know the width: it sends the month and, for a phone, its agenda.
                  <div className={styles.monthNarrow} data-width="narrow">
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
                      empty={labels.nothing('month', 1)}
                      onPress={press}
                      onRestore={session.restore}
                    />
                  </div>
                ) : null}
              </>
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
              items={session.items.filter((item) => !hidden.has(item.kind))}
              labels={labels}
              locale={locale}
              now={now}
              onOpen={pressBlock}
            >
              {legend.length ? (
                <ToggleGroup
                  multiple
                  orientation="vertical"
                  className={styles.legend}
                  aria-label={labels.legend}
                  value={legend.map(({ kind }) => kind).filter((kind) => !hidden.has(kind))}
                  onValueChange={(shownKinds) =>
                    setHidden(
                      new Set(
                        legend.map(({ kind }) => kind).filter((kind) => !shownKinds.includes(kind)),
                      ),
                    )
                  }
                >
                  {legend.map(({ kind, tone }) => (
                    <Toggle key={kind} value={kind} className={styles.legendKind} data-tone={tone}>
                      <span className={styles.swatch} aria-hidden />
                      {labels.kind(kind)}
                    </Toggle>
                  ))}
                  {anyCancelled ? (
                    <span className={styles.legendNote} data-tone="neutral">
                      <span className={styles.swatch} data-cancelled aria-hidden />
                      {labels.cancelled}
                    </span>
                  ) : null}
                  {anyMarked ? (
                    <span className={styles.legendNote} data-tone="neutral">
                      <span className={styles.swatch} data-marked aria-hidden />
                      {labels.changed}
                    </span>
                  ) : null}
                </ToggleGroup>
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
          {pending ? ` ${labels.changes(pending)}` : ''}
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
            sheet={phone}
            side={detailsSide}
            actionsOf={actionsOf}
            onAction={runAction}
          />
        ) : null}

        {editable && (pending || session.error || droppedNote) ? (
          <SaveBar
            labels={labels}
            count={pending}
            saving={session.saving}
            error={session.error}
            note={[droppedNote, session.changes.length ? told : ''].filter(Boolean).join(' ')}
            onSave={session.save}
            onSaveIntent={onSaveIntent}
            onCancel={cancel}
            onDiscard={cancel}
            onDismiss={session.dismissDropped}
          />
        ) : null}
      </WeekSpans.Root>
    </div>
  )
}
