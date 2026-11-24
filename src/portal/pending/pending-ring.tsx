'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { remaining } from './machine'
import { usePendingStore } from './pending-provider'
import styles from './pending-ring.module.css'

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)'
const reduce = () => matchMedia(REDUCED_MOTION).matches
const defaultMotion = () => false
const noItem = () => undefined

function subscribeMotion(change: () => void) {
  const media = matchMedia(REDUCED_MOTION)
  media.addEventListener('change', change)
  return () => media.removeEventListener('change', change)
}

export function PendingRing({ itemKey, label }: { itemKey: string; label: string }) {
  const t = useTranslations('Portal.pending.ring')
  const format = useFormatter()
  const store = usePendingStore()
  const item = useSyncExternalStore(store.subscribe, () => store.getSnapshot().get(itemKey), noItem)
  const reduced = useSyncExternalStore(subscribeMotion, reduce, defaultMotion)
  const button = useRef<HTMLButtonElement>(null)
  const arc = useRef<SVGCircleElement>(null)
  const text = useRef<HTMLSpanElement>(null)
  // `touching` is true while a touch is down, so a focus it causes does not pause. `touched` stays
  // until the next pointerdown, so a click without `pointerType` still reads as a tap.
  const touching = useRef(false)
  const touched = useRef(false)
  const focused = useRef(false)
  const { clock, undoMs } = store
  const tapPaused = item?.causes.has('tap') ?? false

  useEffect(() => {
    if (!item || (item.state !== 'pending' && item.state !== 'paused')) return
    let frame = 0
    let timer = 0
    let shownSeconds = -1
    const tick = () => {
      const ms = remaining(item, clock.now())
      const n = Math.ceil(ms / 1000)
      arc.current?.setAttribute('stroke-dashoffset', String(1 - ms / undoMs))
      if (shownSeconds !== n) {
        shownSeconds = n
        if (text.current) text.current.textContent = format.number(n, 'digits')
        button.current?.setAttribute(
          'aria-label',
          t(item.state === 'paused' ? 'paused' : 'countdown', { label, n }),
        )
      }
      if (item.state !== 'pending' || ms === 0) return
      if (reduced) timer = window.setTimeout(tick, ms - (n - 1) * 1000)
      else frame = requestAnimationFrame(tick)
    }
    tick()
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(timer)
    }
  }, [clock, format, item, label, reduced, t, undoMs])

  useEffect(() => {
    if (!tapPaused) return
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node) || !button.current?.contains(target)
    const pointer = (event: PointerEvent) => {
      if (outside(event.target)) store.resume(itemKey, 'tap')
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && outside(event.target)) store.resume(itemKey, 'tap')
    }
    document.addEventListener('pointerdown', pointer, true)
    document.addEventListener('keydown', keydown, true)
    return () => {
      document.removeEventListener('pointerdown', pointer, true)
      document.removeEventListener('keydown', keydown, true)
      store.resume(itemKey, 'tap')
    }
  }, [itemKey, store, tapPaused])

  useEffect(
    () => () => {
      if (focused.current) store.resume(itemKey, 'focus')
    },
    [itemKey, store],
  )

  if (!item || item.state === 'undone') return null
  const disabled = item.state === 'committing' || item.state === 'sent'
  const active = item.state === 'pending' || item.state === 'paused'
  const n = Math.ceil(item.remainingMs / 1000)

  return (
    <button
      ref={button}
      type="button"
      className={styles.ring}
      aria-disabled={disabled || undefined}
      aria-label={
        active
          ? t(item.state === 'paused' ? 'paused' : 'countdown', { label, n })
          : t('undo', { label })
      }
      data-undo-ms={undoMs}
      onPointerDown={(event) => {
        touching.current = touched.current = event.pointerType === 'touch'
      }}
      onPointerUp={() => {
        touching.current = false
      }}
      onPointerLeave={() => {
        touching.current = false
      }}
      onPointerCancel={() => {
        touching.current = touched.current = false
      }}
      onFocus={() => {
        if (touching.current || disabled) return
        focused.current = true
        store.pause(itemKey, 'focus')
      }}
      onBlur={() => {
        if (!focused.current) return
        focused.current = false
        store.resume(itemKey, 'focus')
      }}
      onClick={(event) => {
        const pointer = event.nativeEvent
        const tapped =
          'pointerType' in pointer
            ? pointer.pointerType === 'touch'
            : event.detail > 0 && touched.current
        touched.current = false
        if (disabled) return
        if (tapped && active && !tapPaused) store.pause(itemKey, 'tap')
        else store.undo(itemKey)
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape' || disabled) return
        event.preventDefault()
        event.stopPropagation()
        store.undo(itemKey)
      }}
    >
      {!reduced && active && (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.arc}>
          <circle cx="12" cy="12" r="10" className={styles.track} />
          <circle
            ref={arc}
            cx="12"
            cy="12"
            r="10"
            pathLength="1"
            strokeDasharray="1"
            strokeDashoffset={1 - item.remainingMs / undoMs}
            transform="rotate(-90 12 12)"
          />
        </svg>
      )}
      <span ref={text} aria-hidden="true">
        {active ? format.number(n, 'digits') : '↶'}
      </span>
    </button>
  )
}
