'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

import styles from './space.module.css'

export type PostLabelTone = 'neutral' | 'info' | 'warning'

export type PostLabelItem = {
  id: string
  label: string
  icon: ReactNode
  tone?: PostLabelTone
}

/**
 * A post's labels as one status pill: icons at rest, names on hover, keyboard focus or a tap.
 * The names stay in the text, clipped, so a screen reader reads them at rest.
 * Arc's expanding button group is an action toolbar that always shows one name, so this
 * keeps its pill and its icon-then-name motion without the buttons.
 */
export function PostLabels({ items }: { items: PostLabelItem[] }) {
  const root = useRef<HTMLUListElement>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close, true)
    return () => document.removeEventListener('pointerdown', close, true)
  }, [open])

  if (items.length === 0) return null
  return (
    <ul
      ref={root}
      className={styles.labelGroup}
      data-open={open || undefined}
      tabIndex={0}
      onClick={() => setOpen((v) => !v)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      {items.map((item) => (
        <li key={item.id} className={styles.labelItem} data-tone={item.tone ?? 'neutral'}>
          <span className={styles.labelIcon} aria-hidden="true">
            {item.icon}
          </span>
          <span className={styles.labelText}>
            <span>{item.label}</span>
          </span>
        </li>
      ))}
    </ul>
  )
}
