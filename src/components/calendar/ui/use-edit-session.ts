'use client'

import type { ChangeDetails, SpanAction, SpansReason } from '@ui-sdk/core'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'

import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'

import { changesOf, keepDeleted, restoreBlock, unsavedIdsOf } from './calendar-edits'
import {
  DEFAULT_MINUTES,
  firstFreeStart,
  newBlock,
  timedBlocks,
  type TimedBlock,
} from './calendar-model'

type Options = {
  items: CalendarItem[]
  /** What a block drawn on an empty slot becomes. Without it nothing can be drawn. */
  newItemKind?: string
  onSave?: (changes: CalendarChange[]) => void | Promise<void>
  /** The calendar's element, searched for the block to put focus back on. */
  scope: RefObject<HTMLElement | null>
  range: { min: number; max: number }
}

type FocusTarget = { id: string; track: string }

/**
 * The blocks as the viewer is editing them, against the blocks as loaded.
 * Nothing leaves the page until `save` sends every change at once; `cancel`
 * drops them all. Loading new items drops them too, since they were made
 * against the old ones.
 */
export function useEditSession({ items, newItemKind, onSave, scope, range }: Options) {
  const itemsKey = useMemo(() => JSON.stringify(items), [items])
  const [loadedKey, setLoadedKey] = useState(itemsKey)
  const [base, setBase] = useState(() => timedBlocks(items))
  const [working, setWorking] = useState(base)
  if (loadedKey !== itemsKey) {
    const fresh = timedBlocks(items)
    setLoadedKey(itemsKey)
    setBase(fresh)
    setWorking(fresh)
  }

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const focusTarget = useRef<FocusTarget | null>(null)

  const changes = useMemo(
    () => changesOf({ items, base, working, newItemKind }),
    [items, base, working, newItemKind],
  )
  const unsaved = useMemo(() => unsavedIdsOf(base, working), [base, working])

  useEffect(() => {
    const target = focusTarget.current
    if (!target) return
    focusTarget.current = null
    const el = scope.current
    const found =
      el?.querySelector<HTMLElement>(`[data-span-id="${CSS.escape(target.id)}"]`) ??
      el?.querySelector<HTMLElement>(`[data-add="${target.track}"]`) ??
      el?.querySelector<HTMLElement>(`[data-track="${target.track}"]`)
    found?.focus()
  }, [working, scope])

  const add = (block: TimedBlock) => {
    focusTarget.current = { id: block.id, track: block.track }
    setWorking((blocks) => [...blocks, block])
  }

  const slot = (track: string) => {
    const start = firstFreeStart(working, track, range.min, range.max)
    return { start, end: Math.min(start + DEFAULT_MINUTES, range.max) }
  }

  return {
    working,
    changes,
    unsaved,
    saving,
    error,

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
          newBlock(null, span.track, span.start, span.end)
      : undefined,

    /** The "+" on a day: a new item's block in the first free hour. */
    drawOnDay(track: string) {
      const { start, end } = slot(track)
      add(newBlock(null, track, start, end))
    },

    /** An item with no block, put on a day: at `start`, or in the first free hour. */
    place(itemId: string, track: string, start?: number) {
      const from = Math.max(
        range.min,
        Math.min(start ?? slot(track).start, range.max - DEFAULT_MINUTES),
      )
      add(newBlock(itemId, track, from, from + DEFAULT_MINUTES))
    },

    restore(id: string) {
      focusTarget.current = { id, track: working.find((block) => block.id === id)?.track ?? '' }
      setWorking((blocks) => restoreBlock(blocks, id))
    },

    cancel() {
      setWorking(base)
      setError(null)
    },

    async save() {
      setSaving(true)
      setError(null)
      try {
        await onSave?.(changes)
        const saved = working.filter((block) => !block.deleted)
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
