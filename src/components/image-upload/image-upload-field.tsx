'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CircleAlert, ImagePlus } from 'lucide-react'

import { Button } from '@/components/arc/button/button'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { outputSize } from '@/lib/image-crop'

import { Cropper, type CropResult } from './cropper'
import { asFile, renderCrop, useImagePick } from './pick'
import { AutoHeight } from './auto-height'
import styles from './image-upload.module.css'

/** The field's value: the picked file, and the address to show (a stored photo or the pick's preview). */
export type ImageValue = { file: File | null; url: string | null }
export const NO_IMAGE: ImageValue = { file: null, url: null }

export type ImageUploadFieldProps = {
  label: string
  value: ImageValue
  onChange: (value: ImageValue) => void
  /** Width over height of the crop and the preview: 16 / 9, 4 / 5, 1 for a square. */
  ratio?: number
  accept: string[]
  /** The largest file in bytes, checked before the photo is decoded. */
  maxSize: number
  /** The long side of the cropped photo, in px; a smaller crop is never enlarged. */
  outputEdge?: number
  /** The empty field's button. */
  addLabel?: string
  /** Words before the generated hint (the kinds and the size limit). */
  description?: string
}

const STAGE_PAD = 20

/**
 * One photo for a form field, on the avatar upload's engine: pick or drop it,
 * crop it to the field's ratio, and the cropped file goes to the form with
 * the rest. Nothing uploads until the form is sent.
 */
export function ImageUploadField({
  label,
  value,
  onChange,
  ratio = 16 / 9,
  accept,
  maxSize,
  outputEdge = 1600,
  addLabel,
  description,
}: ImageUploadFieldProps) {
  const t = useTranslations('ImageUpload')
  const reduce = !!useReducedMotion()
  const id = useId()
  const action = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  const root = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pick = useImagePick({
    accept,
    maxSize,
    locked: busy,
    onPicked: () => setError(null),
    onError: setError,
  })
  const { words, picked } = pick
  // A preview made here is let go when the value moves on.
  const preview = value.file ? value.url : null
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview])
  useEffect(() => {
    const node = root.current
    if (!node || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => entry && setWidth(entry.contentRect.width))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!refocus.current || picked) return
    refocus.current = false
    action.current?.focus()
  }, [picked, value.url])

  const save = async (rect: CropResult) => {
    if (!picked) return
    refocus.current = true
    setBusy(true)
    const blob = await renderCrop(picked, rect, outputSize(ratio, outputEdge, rect))
    const file = asFile(blob, picked.file)
    setBusy(false)
    onChange({ file, url: URL.createObjectURL(file) })
    pick.clear()
  }

  const frameWidth = Math.max(160, Math.round(width - STAGE_PAD * 2))
  const smooth = reduce ? { duration: 0 } : motionTokens.spring.smooth
  const layoutId = `${id}-image`

  return (
    <div ref={root} className={styles.field} role="group" aria-labelledby={`${id}-label`}>
      <span id={`${id}-label`} className={styles.fieldLabel}>
        {label}
      </span>
      <input {...pick.inputProps} />
      <AutoHeight>
        {picked && width > 0 ? (
          <Cropper
            src={picked.url}
            image={picked.size}
            frame={{ width: frameWidth, height: Math.round(frameWidth / ratio) }}
            shape="rect"
            layoutId={layoutId}
            saveLabel={t('use')}
            onSave={save}
            onCancel={() => {
              refocus.current = true
              pick.clear()
            }}
          />
        ) : value.url ? (
          <motion.div
            layoutId={layoutId}
            className={styles.preview}
            style={{ aspectRatio: ratio, borderRadius: 'var(--radius-control)' }}
            transition={smooth}
            data-over={pick.over || undefined}
            {...pick.dropProps}
          >
            {/* A local preview or the stored private file; next/image cannot read either. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value.url} alt="" draggable={false} />
            <div className={styles.previewActions}>
              <Button
                ref={action}
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={pick.open}
              >
                {t('replace')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => {
                  refocus.current = true
                  setError(null)
                  onChange(NO_IMAGE)
                }}
              >
                {t('remove')}
              </Button>
            </div>
          </motion.div>
        ) : (
          <button
            ref={action}
            type="button"
            className={styles.add}
            aria-describedby={`${id}-message`}
            disabled={busy}
            data-over={pick.over || undefined}
            onClick={pick.open}
            {...pick.dropProps}
          >
            <ImagePlus size={18} aria-hidden="true" />
            {addLabel ?? t('add')}
          </button>
        )}
      </AutoHeight>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.p
          key={error ?? 'hint'}
          id={`${id}-message`}
          className={styles.message}
          data-tone={error ? 'error' : 'hint'}
          initial={reduce ? false : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }}
          transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.fast }}
        >
          {error && <CircleAlert size={14} aria-hidden="true" />}
          <span>{error ?? (description ? `${description} ${words.hint}.` : words.hint)}</span>
        </motion.p>
      </AnimatePresence>
      <p className={styles.srOnly} aria-live="polite">
        {error ?? ''}
      </p>
    </div>
  )
}
