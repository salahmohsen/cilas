'use client'

import type { ChangeDetails, SpanAction, SpansReason } from '@ui-sdk/core'
import { useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import { changesOf, keepDeleted, rebase, restoreBlock, unsavedIdsOf } from './calendar-edits'
import { addDays } from './calendar-time'
import {
  DEFAULT_MINUTES,
  DEFAULT_START_MINUTES,
  firstFreeStart,
  newBlock,
  newItemId,
  timedBlocks,
  type TimedBlock,
} from './calendar-model'

type Options = {
  items: CalendarItem[]
  /** What a block drawn on an empty slot becomes. Without it nothing can be drawn. */
  newItemKind?: string
  /** May return the items as saved, which replace the ones shown. */
  onSave?: (changes: CalendarChange[]) => void | CalendarItem[] | Promise<void | CalendarItem[]>
  /** The calendar's element, searched for the block to put focus back on. */
  scope: RefObject<HTMLElement | null>
  range: { min: number; max: number }
}

type FocusTarget = { id: string; track: string }

/**
 * The blocks as the viewer is editing them, against the blocks as loaded.
 * Nothing leaves the page until `save` sends every change at once; `cancel`
 * drops them all. New items from outside keep the changes to items that did
 * not change, and drop those to items that did, which `dropped` names. A save
 * that returns the saved items shows those, so the next save carries their new versions.
 */
export function useEditSession({ items, newItemKind, onSave, scope, range }: Options) {
  const itemsKey = useMemo(() => JSON.stringify(items), [items])
  const [loadedKey, setLoadedKey] = useState(itemsKey)
  const [current, setCurrent] = useState(items)
  const [base, setBase] = useState(() => timedBlocks(items))
  const [working, setWorking] = useState(base)
  /** The titles of items whose unsaved changes were dropped when newer items loaded. */
  const [dropped, setDropped] = useState<string[]>([])

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const focusTarget = useRef<FocusTarget | null>(null)

  const changes = useMemo(
    () => changesOf({ items: current, base, working, newItemKind }),
    [current, base, working, newItemKind],
  )
  const unsaved = useMemo(() => unsavedIdsOf(base, working), [base, working])

  // New items from outside, such as a form that saved a session. A save's own
  // result replaces all of this when it returns, and clears the note.
  if (loadedKey !== itemsKey) {
    const next = rebase({
      current,
      items,
      working,
      changed: new Set(changes.flatMap((change) => ('itemId' in change ? [change.itemId] : []))),
    })
    setLoadedKey(itemsKey)
    setCurrent(items)
    setBase(next.base)
    setWorking(next.working)
    if (next.dropped.length) setDropped(next.dropped)
  }

  /** The block to put focus on, or the "+" or day it was on when the block is gone. */
  const focusable = useCallback(
    (target: FocusTarget) => {
      const el = scope.current
      return (
        el?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(target.id)}"]`) ??
        el?.querySelector<HTMLElement>(`[data-add="${target.track}"]`) ??
        el?.querySelector<HTMLElement>(`[data-track="${target.track}"]`) ??
        null
      )
    },
    [scope],
  )

  useEffect(() => {
    const target = focusTarget.current
    if (!target) return
    focusTarget.current = null
    focusable(target)?.focus()
  }, [working, focusable])

  const add = (block: TimedBlock) => {
    focusTarget.current = { id: block.id, track: block.track }
    setWorking((blocks) => [...blocks, block])
  }

  const slot = (track: string) => {
    const start = firstFreeStart(
      working,
      track,
      Math.max(range.min, DEFAULT_START_MINUTES),
      range.max,
    )
    return { start, end: Math.min(start + DEFAULT_MINUTES, range.max) }
  }

  return {
    /** The items as loaded or as last saved. */
    items: current,
    working,
    changes,
    unsaved,
    saving,
    error,
    dropped,
    dismissDropped: () => setDropped([]),

    /** A drag or key changed the blocks. */
    onSpansChange(
      value: TimedBlock[],
      details: ChangeDetails<SpansReason> & { id: string; action: SpanAction },
    ) {
      const track = [...value, ...working].find((block) => block.id === details.id)?.track
      if (track && (details.reason === 'move-key' || details.action === 'delete')) {
        focusTarget.current = { id: details.id, track }
      }
      setWorking(
        details.action === 'delete' ? keepDeleted(working, value, details.id, base) : value,
      )
    },

    /** A press on an empty stretch of day draws a block of a new item, if the host allows new items. */
    draw: newItemKind
      ? (span: { track: string; start: number; end: number }) =>
          newBlock(newItemId(), span.track, span.start, span.end)
      : undefined,

    /** The "+" on a day: a new item's block in the first free hour. */
    drawOnDay(track: string) {
      const { start, end } = slot(track)
      add(newBlock(newItemId(), track, start, end))
    },

    /** An item with no block, put on a day: at `start`, or in the first free hour. */
    place(itemId: string, track: string, start?: number) {
      const from = Math.max(
        range.min,
        Math.min(start ?? slot(track).start, range.max - DEFAULT_MINUTES),
      )
      add(newBlock(itemId, track, from, from + DEFAULT_MINUTES))
    },

    /** The same time on the next day, on the block's item. Returns the new block. */
    addNextDay(id: string): TimedBlock | null {
      const block = working.find((candidate) => candidate.id === id)
      if (!block) return null
      const copy = newBlock(block.itemId, addDays(block.track, 1), block.start, block.end)
      setWorking((blocks) => [...blocks, copy])
      return copy
    },

    /** A new item with all the live blocks of this block's item, 7 days later. Returns its blocks. */
    copyNextWeek(id: string): TimedBlock[] {
      const block = working.find((candidate) => candidate.id === id)
      if (!block) return []
      const itemId = newItemId()
      const copies = working
        .filter((candidate) => candidate.itemId === block.itemId && !candidate.deleted)
        .map((live) => newBlock(itemId, addDays(live.track, 7), live.start, live.end))
      setWorking((blocks) => [...blocks, ...copies])
      return copies
    },

    /** Delete one block: a loaded one stays as a ghost, one made on the page is gone. */
    removeBlock(id: string) {
      const track = working.find((block) => block.id === id)?.track
      if (!track) return
      focusTarget.current = { id, track }
      setWorking((blocks) =>
        keepDeleted(
          blocks,
          blocks.filter((block) => block.id !== id),
          id,
          base,
        ),
      )
    },

    /** Where focus goes when the block menu closes: the block, or what is left of it. */
    focusable,

    restore(id: string) {
      focusTarget.current = { id, track: working.find((block) => block.id === id)?.track ?? '' }
      setWorking((blocks) => restoreBlock(blocks, id))
    },

    cancel() {
      setWorking(base)
      setError(null)
      setDropped([])
    },

    async save() {
      setSaving(true)
      setError(null)
      try {
        const fresh = await onSave?.(changes)
        if (fresh) setCurrent(fresh)
        setDropped([])
        const saved = fresh ? timedBlocks(fresh) : working.filter((block) => !block.deleted)
        setBase(saved)
        setWorking(saved)
      } catch (failure) {
        setError(failure instanceof Error ? failure : new Error(String(failure)))
      } finally {
        setSaving(false)
      }
    },
  }
}
