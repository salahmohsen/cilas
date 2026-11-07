'use client'

import { forwardRef, useId, useImperativeHandle, useRef } from 'react'
import type { ReactNode } from 'react'
import { RichTextEditor } from '@/components/arc/rich-text-editor/rich-text-editor'
import type {
  RichTextEditorHandle,
  RichTextEditorProps,
} from '@/components/arc/rich-text-editor/rich-text-editor'
import styles from './rich-field.module.css'

export interface RichFieldProps extends Omit<
  RichTextEditorProps,
  'aria-label' | 'aria-labelledby' | 'aria-describedby' | 'aria-invalid' | 'aria-required' | 'id'
> {
  label: string
  description?: string
  error?: string
  /** A live count such as "120 of 500", read with the field. */
  counter?: ReactNode
  /** Keeps the label for assistive tech only, where the surrounding page already names the field. */
  hideLabel?: boolean
  required?: boolean
  disabled?: boolean
  dir?: 'ltr' | 'rtl'
  className?: string
}

export const RichField = forwardRef<RichTextEditorHandle, RichFieldProps>(function RichField(
  {
    label,
    description,
    error,
    counter,
    hideLabel,
    required,
    disabled,
    dir,
    className,
    readOnly,
    ...editor
  },
  ref,
) {
  const uid = useId()
  const editorRef = useRef<RichTextEditorHandle>(null)
  useImperativeHandle(ref, () => editorRef.current as RichTextEditorHandle)
  const labelId = `${uid}-label`
  const hintId = description ? `${uid}-description` : undefined
  const errorId = error ? `${uid}-error` : undefined
  const counterId = counter ? `${uid}-counter` : undefined
  const describedBy = [hintId, counterId, errorId].filter(Boolean).join(' ') || undefined
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label
        id={labelId}
        className={hideLabel ? styles.srOnly : styles.label}
        onClick={() => editorRef.current?.focus()}
      >
        {label}
      </label>
      <div
        className={styles.frame}
        dir={dir}
        data-invalid={error ? '' : undefined}
        data-disabled={disabled ? '' : undefined}
      >
        <RichTextEditor
          {...editor}
          ref={editorRef}
          id={`${uid}-editor`}
          aria-labelledby={labelId}
          aria-describedby={describedBy}
          aria-invalid={!!error}
          aria-required={required}
          aria-disabled={disabled}
          readOnly={readOnly || disabled}
        />
      </div>
      {description && (
        <span id={hintId} className={styles.description}>
          {description}
        </span>
      )}
      {counter && (
        <span id={counterId} className={styles.counter}>
          {counter}
        </span>
      )}
      {error && (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  )
})
