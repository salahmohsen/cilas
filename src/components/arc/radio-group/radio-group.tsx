'use client'
import { useEffect, useId, useLayoutEffect, useRef, type ReactNode } from 'react'
import { animate, motion, useReducedMotion } from 'motion/react'
import { motionTokens } from '../lib/motion-tokens'
import styles from './radio-group.module.css'
export interface RadioGroupProps {
  label: string
  /** Keeps the legend for screen readers only, when a heading nearby already names the group. */
  labelHidden?: boolean
  options: { value: string; label: string; description?: import('react').ReactNode }[]
  value: string
  onValueChange: (value: string) => void
  name?: string
  /** Help text under the legend; may hold links. */
  description?: ReactNode
  /** What is wrong with the choice, shown under the options. */
  error?: string
  required?: boolean
  disabled?: boolean
  /** Called when focus leaves the group. */
  onBlur?: () => void
}

/** Sizes the highlight to the chosen row. A new choice glides on the morph spring; the first paint and resizes place it at once. */
function place(
  highlight: HTMLElement | null,
  row: HTMLElement | null | undefined,
  at: { current: string },
  glide: boolean,
) {
  const next = row ? `${row.offsetTop} ${row.offsetHeight}` : ''
  if (!highlight || next === at.current) return
  const visible = at.current !== ''
  at.current = next
  if (!row) {
    animate(highlight, { opacity: 0 }, { duration: 0 })
    return
  }
  const target = { y: row.offsetTop, height: row.offsetHeight, opacity: 1 }
  if (glide && visible) {
    animate(highlight, target, { ...motionTokens.spring.morph, opacity: { duration: 0 } })
    return
  }
  // Written to the element too, so the paint that drops the server fallback already shows the highlight in place.
  Object.assign(highlight.style, {
    transform: `translateY(${target.y}px)`,
    height: `${target.height}px`,
    opacity: '1',
  })
  animate(highlight, target, { duration: 0 })
}

/** One highlight travels to the chosen row while the new dot springs in and the old one shrinks away, so a change reads as a single physical move. Arrow keys take the same path. Rows and text never resize. */
export function RadioGroup({
  label,
  labelHidden = false,
  options,
  value,
  onValueChange,
  name,
  description,
  error,
  required,
  disabled,
  onBlur,
}: RadioGroupProps) {
  const id = useId()
  const reduced = useReducedMotion()
  const listRef = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLSpanElement>(null)
  const rows = useRef<(HTMLLabelElement | null)[]>([])
  const shown = useRef<number | null>(null)
  const at = useRef('')
  const selected = options.findIndex((option) => option.value === value)
  useLayoutEffect(() => {
    place(
      highlightRef.current,
      rows.current[selected],
      at,
      shown.current !== null && shown.current !== selected && !reduced,
    )
    shown.current = selected
    listRef.current?.setAttribute('data-ready', '')
  }, [selected, reduced])
  useEffect(() => {
    const list = listRef.current
    if (!list || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() =>
      place(highlightRef.current, rows.current[shown.current ?? -1], at, false),
    )
    observer.observe(list)
    rows.current.forEach((row) => row && observer.observe(row))
    return () => observer.disconnect()
  }, [options.length])
  return (
    <fieldset
      aria-describedby={
        [description ? `${id}-description` : '', error ? `${id}-error` : '']
          .filter(Boolean)
          .join(' ') || undefined
      }
      aria-invalid={error ? true : undefined}
      className={styles.group}
      disabled={disabled}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) onBlur?.()
      }}
    >
      <legend className={labelHidden ? 'sr-only' : undefined}>{label}</legend>
      {description ? (
        <div className={styles.description} id={`${id}-description`}>
          {description}
        </div>
      ) : null}
      <div ref={listRef} className={styles.options}>
        <span ref={highlightRef} className={styles.highlight} aria-hidden="true" />
        {options.map((option, index) => {
          const checked = value === option.value
          return (
            <label
              className={styles.option}
              key={option.value}
              ref={(node) => {
                rows.current[index] = node
              }}
            >
              <input
                type="radio"
                name={name ?? id}
                value={option.value}
                checked={checked}
                required={required}
                onChange={() => onValueChange(option.value)}
              />
              <span className={styles.mark} aria-hidden="true">
                <motion.span
                  className={styles.dot}
                  initial={false}
                  animate={checked ? { scale: 1, opacity: 1 } : { scale: 0.4, opacity: 0 }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : {
                          ...motionTokens.spring.snappy,
                          opacity: {
                            duration: checked
                              ? motionTokens.duration.fast
                              : motionTokens.duration.instant,
                          },
                        }
                  }
                />
              </span>
              <span>
                <strong>{option.label}</strong>
                {option.description && <small>{option.description}</small>}
              </span>
            </label>
          )
        })}
      </div>
      {error ? (
        <p className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  )
}
