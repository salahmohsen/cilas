'use client'
import { forwardRef, useId, useRef } from 'react'
import type { InputHTMLAttributes, ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Search, X as Xmark } from 'lucide-react'
import { motionTokens } from '../lib/motion-tokens'
import styles from './search-field.module.css'
export interface SearchFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string
  value: string
  onValueChange: (value: string) => void
  clearLabel?: string
  /** Keeps the visible label out of the layout, for fields that carry no caption above them. */
  labelHidden?: boolean
  /**
   * A keyboard-hint chip at the field's inner edge, shown exactly while the
   * field is empty — the clear control owns that spot once text arrives.
   */
  hint?: ReactNode
  /**
   * Frameless on small screens: the field fills its row and the shell shows
   * no border or background until the md breakpoint returns it.
   */
  bare?: boolean
}
export const SearchField = forwardRef<HTMLInputElement, SearchFieldProps>(function SearchField(
  {
    label,
    value,
    onValueChange,
    clearLabel = 'Clear search',
    labelHidden,
    hint,
    bare,
    id,
    className,
    ...props
  },
  ref,
) {
  const generated = useId()
  const controlId = id ?? generated
  const reduced = useReducedMotion()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const setRefs = (node: HTMLInputElement | null) => {
    inputRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }
  // Clearing returns focus to the field, since the clear button unmounts under the pointer.
  function clear() {
    onValueChange('')
    inputRef.current?.focus()
  }
  return (
    <div className={styles.field}>
      <label htmlFor={controlId} className={labelHidden ? 'sr-only' : undefined}>
        {label}
      </label>
      <div
        className={[styles.shell, bare ? styles.bare : ''].filter(Boolean).join(' ')}
        data-filled={value ? 'true' : undefined}
      >
        <Search width={18} height={18} aria-hidden="true" />
        <input
          {...props}
          ref={setRefs}
          id={controlId}
          type="search"
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          className={[styles.input, className].filter(Boolean).join(' ')}
        />
        {/* The hint lives as a shell child only when the field is empty;
            the clear control keeps its own reserved slot afterwards, and
            the two are never present at once. */}
        {hint && !value ? <span className="flex shrink-0 items-center">{hint}</span> : null}
        {value ? (
          <span className={styles.clearSlot}>
            <AnimatePresence initial={false}>
              <motion.button
                key="clear"
                type="button"
                tabIndex={0}
                onClick={clear}
                aria-label={clearLabel}
                initial={
                  reduced
                    ? { opacity: 0 }
                    : { opacity: 0, scale: 0.8, filter: `blur(${motionTokens.blur.subtle}px)` }
                }
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={
                  reduced
                    ? { opacity: 0, transition: { duration: 0 } }
                    : {
                        opacity: 0,
                        scale: 0.8,
                        filter: `blur(${motionTokens.blur.subtle}px)`,
                        transition: {
                          duration: motionTokens.duration.instant,
                          ease: [...motionTokens.ease.standard],
                        },
                      }
                }
                whileTap={
                  reduced
                    ? undefined
                    : {
                        scale: 0.96,
                        transition: {
                          duration: motionTokens.duration.instant,
                          ease: [...motionTokens.ease.standard],
                        },
                      }
                }
                transition={
                  reduced
                    ? { duration: motionTokens.duration.instant }
                    : {
                        ...motionTokens.spring.snappy,
                        opacity: { duration: motionTokens.duration.fast },
                        filter: { duration: motionTokens.duration.fast },
                      }
                }
              >
                <Xmark width={16} height={16} aria-hidden="true" />
              </motion.button>
            </AnimatePresence>
          </span>
        ) : null}
      </div>
    </div>
  )
})
