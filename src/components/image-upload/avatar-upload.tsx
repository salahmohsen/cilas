'use client'

import {
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
  type Ref,
} from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Camera, Check, CircleAlert } from 'lucide-react'

import { Button } from '@/components/arc/button/button'
import { motionTokens } from '@/components/arc/lib/motion-tokens'
import { outputSize } from '@/lib/image-crop'
import { downscaleImage } from '@/lib/image-downscale'

import { Cropper, type CropResult } from './cropper'
import {
  DEFAULT_ACCEPT,
  DEFAULT_MAX_SIZE,
  decodePhoto,
  dropPicked,
  renderCrop,
  useUploadWords,
  type Picked,
  type UploadError,
} from './pick'
import { AutoHeight } from './auto-height'
import { useLoadedSrc } from './use-photo'
import styles from './image-upload.module.css'

export type AvatarUploadHandle = {
  /** Shows the file picker. */
  open: () => void
  /** Runs a file through the same checks as a pick or a drop. */
  selectFile: (file: File) => void
}

export type AvatarUploadProps = {
  /** The person's name, for the initials when there is no photo. */
  name: string
  /** The current photo. Changing it replaces the shown photo. */
  src?: string | null
  /**
   * Receives the cropped square photo. Call `report` with 0 to 1 to fill the
   * ring; until then it turns without a value. Resolve with the stored URL,
   * or with nothing to keep the local crop. Reject with an Error whose message
   * is shown as is.
   */
  onUpload: (
    image: Blob,
    context: { report: (progress: number) => void; signal: AbortSignal; original: File },
  ) => Promise<string | void>
  /** Called by Remove; without it there is no Remove. A rejected promise keeps the photo. */
  onRemove?: () => void | Promise<void>
  onError?: (error: UploadError) => void
  accept?: string[]
  /** The largest file in bytes, checked before the photo is decoded. */
  maxSize?: number
  /** The avatar's diameter at rest, in px. The crop circle is 184px. */
  size?: number
  /** The side of the square passed to `onUpload`, in px. */
  outputSize?: number
  /** False skips the crop step: the photo uploads as chosen, shrunk like a post's photos. */
  crop?: boolean
  label?: string
  hint?: ReactNode
  disabled?: boolean
  className?: string
  style?: CSSProperties
  ref?: Ref<AvatarUploadHandle>
}

type Phase = 'idle' | 'crop' | 'uploading' | 'failed' | 'done'
type Note = { tone: 'hint' | 'success' | 'error'; text: ReactNode } | null

const CROP = 184
const SETTLE_MS = 480

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

/**
 * A profile photo control after Arc's avatar upload: click or drop a photo on
 * the avatar, crop it in a circle the avatar grows into, and watch it upload
 * through a ring around the avatar. Errors are explained in place, with retry.
 */
export function AvatarUpload({
  name,
  src,
  onUpload,
  onRemove,
  onError,
  accept = DEFAULT_ACCEPT,
  maxSize = DEFAULT_MAX_SIZE,
  size = 88,
  outputSize: edge = 512,
  crop = true,
  label,
  hint,
  disabled,
  className,
  style,
  ref,
}: AvatarUploadProps) {
  const t = useTranslations('ImageUpload')
  const words = useUploadWords(accept, maxSize)
  const reduce = !!useReducedMotion()
  const id = useId()
  const picker = useRef<HTMLInputElement>(null)
  const action = useRef<HTMLButtonElement>(null)
  const refocus = useRef(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [pending, setPending] = useState<{ blob: Blob; url: string; original: File } | null>(null)
  const [progress, setProgress] = useState<number | null>(null)
  const [note, setNote] = useState<Note>(null)
  const [announce, setAnnounce] = useState('')
  const [over, setOver] = useState(false)
  const controller = useRef<AbortController | null>(null)
  // A local photo (an upload that kept no URL) or a removal, until `src` changes.
  const [local, setLocal] = useState<{ for: string | null | undefined; url: string | null }>()
  const current = local && local.for === src ? local.url : (src ?? null)
  const shown = useLoadedSrc(current)
  const name_ = label ?? t('avatarLabel')

  useEffect(() => () => dropPicked(picked), [picked])
  useEffect(() => () => void (pending && URL.revokeObjectURL(pending.url)), [pending])
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    if (!refocus.current || phase === 'crop') return
    refocus.current = false
    action.current?.focus()
  }, [phase])

  const fail = (error: UploadError) => {
    setNote({ tone: 'error', text: error.message })
    setAnnounce(error.message)
    onError?.(error)
  }

  const upload = async (blob: Blob, original: File) => {
    const ctrl = new AbortController()
    controller.current = ctrl
    setPending((old) =>
      old?.blob === blob ? old : { blob, url: URL.createObjectURL(blob), original },
    )
    setProgress(null)
    setPhase('uploading')
    setNote({ tone: 'hint', text: t('uploading') })
    setAnnounce(t('uploading'))
    let step = 0
    const report = (value: number) => {
      if (ctrl.signal.aborted) return
      const p = Math.min(1, Math.max(0, value))
      setProgress(p)
      setNote({ tone: 'hint', text: t('uploadingPercent', { percent: Math.round(p * 100) }) })
      if (Math.floor(p * 4) > step) {
        step = Math.floor(p * 4)
        setAnnounce(t('uploadingPercent', { percent: step * 25 }))
      }
    }
    try {
      const url = await onUpload(blob, { report, signal: ctrl.signal, original })
      if (ctrl.signal.aborted) return
      setProgress(1)
      setPhase('done')
      setLocal({ for: src, url: url || URL.createObjectURL(blob) })
      setNote({ tone: 'success', text: t('updated') })
      setAnnounce(t('updated'))
      window.setTimeout(
        () => {
          setPhase((p) => (p === 'done' ? 'idle' : p))
          setPending(null)
        },
        reduce ? 0 : SETTLE_MS + 280,
      )
    } catch (error) {
      if (ctrl.signal.aborted) return
      setPhase('failed')
      const message = error instanceof Error && error.message ? error.message : ''
      fail({ code: 'upload', message: message || words.upload.message })
    }
  }

  const take = async (file: File) => {
    if (disabled || phase === 'uploading') return
    const issue = words.check(file)
    if (issue) return fail(issue)
    if (!crop) {
      setNote(null)
      return upload(await downscaleImage(file), file)
    }
    const next = await decodePhoto(file)
    if (!next) return fail(words.decode)
    setPicked(next)
    setNote(null)
    setPhase('crop')
  }

  useImperativeHandle(ref, () => ({
    open: () => picker.current?.click(),
    selectFile: (file) => void take(file),
  }))

  const save = async (rect: CropResult) => {
    if (!picked) return
    refocus.current = true
    const blob = await renderCrop(picked, rect, outputSize(1, edge))
    const original = picked.file
    setPicked(null)
    void upload(blob, original)
  }

  const cancelCrop = () => {
    refocus.current = true
    setPicked(null)
    setPhase('idle')
  }

  const cancelUpload = () => {
    controller.current?.abort()
    refocus.current = true
    setPending(null)
    setPhase('idle')
    setNote(null)
  }

  const remove = async () => {
    if (!onRemove || disabled) return
    try {
      await onRemove()
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : ''
      return fail({ code: 'upload', message: message || words.upload.message })
    }
    refocus.current = true
    setLocal({ for: src, url: null })
    setNote({ tone: 'hint', text: t('removed') })
    setAnnounce(t('removed'))
    setPhase('idle')
  }

  const busy = phase === 'uploading' || phase === 'done'
  const inset = phase === 'uploading' || phase === 'failed'
  const photo = pending && phase !== 'idle' ? pending.url : shown
  const message = note ?? { tone: 'hint' as const, text: hint ?? words.hint }
  const layoutId = `${id}-avatar`
  const smooth = reduce ? { duration: 0 } : motionTokens.spring.smooth

  return (
    <div
      className={[styles.avatarUpload, className].filter(Boolean).join(' ')}
      style={style}
      role="group"
      aria-label={name_}
      data-disabled={disabled || undefined}
    >
      <input
        ref={picker}
        type="file"
        hidden
        accept={accept.join(',')}
        onChange={(event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ''
          if (file) void take(file)
        }}
      />
      <AutoHeight>
        {phase === 'crop' && picked ? (
          <Cropper
            src={picked.url}
            image={picked.size}
            frame={{ width: CROP, height: CROP }}
            shape="circle"
            layoutId={layoutId}
            saveLabel={t('save')}
            onSave={save}
            onCancel={cancelCrop}
          />
        ) : (
          <div className={styles.rest}>
            <motion.button
              type="button"
              layoutId={layoutId}
              className={styles.avatar}
              style={{ width: size, height: size, borderRadius: 9999 }}
              transition={smooth}
              aria-label={shown ? t('avatarChange') : t('avatarUpload')}
              aria-disabled={disabled || busy || undefined}
              data-over={over || undefined}
              data-busy={busy || inset || undefined}
              onClick={() => !disabled && !busy && !inset && picker.current?.click()}
              onDragOver={(event) => {
                if (disabled || busy) return
                event.preventDefault()
                setOver(true)
              }}
              onDragLeave={() => setOver(false)}
              onDrop={(event) => {
                event.preventDefault()
                setOver(false)
                const file = event.dataTransfer.files[0]
                if (file) void take(file)
              }}
            >
              <motion.span
                className={styles.avatarPhoto}
                initial={false}
                animate={{ scale: inset ? 0.9 : 1 }}
                transition={
                  reduce
                    ? { duration: 0 }
                    : phase === 'done'
                      ? { ...motionTokens.spring.snappy, delay: 0.22 }
                      : motionTokens.spring.smooth
                }
              >
                {photo ? (
                  // eslint-disable-next-line @next/next/no-img-element -- a local crop or the member's stored photo
                  <img src={photo} alt="" draggable={false} />
                ) : (
                  <span className={styles.initials} aria-hidden="true">
                    {initialsOf(name)}
                  </span>
                )}
                <motion.span
                  className={styles.scrim}
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: inset ? 1 : 0 }}
                  transition={
                    reduce
                      ? { duration: 0 }
                      : {
                          duration: motionTokens.duration.standard,
                          delay: phase === 'done' ? 0.22 : 0,
                        }
                  }
                />
              </motion.span>
              <span className={styles.camera} aria-hidden="true">
                <Camera size={Math.round(size / 4)} strokeWidth={1.75} />
              </span>
              <Ring phase={phase} progress={progress} reduce={reduce} />
            </motion.button>

            <div className={styles.side}>
              <p className={styles.title}>{name_}</p>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.p
                  key={`${message.tone}-${typeof message.text === 'string' ? message.text.replace(/\d+%$/, '') : 'x'}`}
                  className={styles.message}
                  data-tone={message.tone}
                  initial={reduce ? false : { opacity: 0, y: 2 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={
                    reduce
                      ? { opacity: 0, transition: { duration: 0 } }
                      : { opacity: 0, transition: { duration: motionTokens.duration.exit } }
                  }
                  transition={reduce ? { duration: 0 } : { duration: motionTokens.duration.fast }}
                >
                  {message.tone === 'success' && <Check size={14} aria-hidden="true" />}
                  {message.tone === 'error' && <CircleAlert size={14} aria-hidden="true" />}
                  <span>{message.text}</span>
                </motion.p>
              </AnimatePresence>
              <div className={styles.actions}>
                {phase === 'uploading' ? (
                  <Button
                    ref={action}
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={cancelUpload}
                  >
                    {t('cancelUpload')}
                  </Button>
                ) : phase === 'failed' && pending ? (
                  <>
                    <Button
                      ref={action}
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => void upload(pending.blob, pending.original)}
                    >
                      {t('tryAgain')}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelUpload}>
                      {t('discard')}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      ref={action}
                      type="button"
                      size="sm"
                      variant="secondary"
                      disabled={disabled || phase === 'done'}
                      onClick={() => picker.current?.click()}
                    >
                      {shown ? t('replace') : t('upload')}
                    </Button>
                    {onRemove && shown && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={disabled || phase === 'done'}
                        onClick={() => void remove()}
                      >
                        {t('remove')}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </AutoHeight>
      <p className={styles.srOnly} aria-live="polite">
        {announce}
      </p>
    </div>
  )
}

/**
 * The ring outside the inset photo: it turns while waiting, fills with the
 * reported progress, stops and turns to the danger colour on a failure, and
 * on success closes and lets a second ring widen and fade.
 */
function Ring({
  phase,
  progress,
  reduce,
}: {
  phase: Phase
  progress: number | null
  reduce: boolean
}) {
  const shown = phase === 'uploading' || phase === 'failed' || phase === 'done'
  const waiting = phase === 'uploading' && progress === null
  return (
    <AnimatePresence>
      {shown && (
        <motion.svg
          key="ring"
          className={styles.ring}
          viewBox="0 0 100 100"
          aria-hidden="true"
          data-waiting={waiting || undefined}
          data-failed={phase === 'failed' || undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: reduce ? 0 : motionTokens.duration.exit } }}
        >
          <circle className={styles.ringTrack} cx="50" cy="50" r="49" />
          <motion.circle
            className={styles.ringValue}
            cx="50"
            cy="50"
            r="49"
            initial={{ pathLength: 0.25 }}
            animate={{ pathLength: phase === 'done' ? 1 : (progress ?? 0.25) }}
            transition={reduce ? { duration: 0 } : motionTokens.spring.smooth}
          />
          {phase === 'done' && !reduce && (
            <motion.circle
              className={styles.ringSettle}
              cx="50"
              cy="50"
              r="49"
              initial={{ scale: 1, opacity: 1 }}
              animate={{ scale: 1.12, opacity: 0 }}
              transition={{
                duration: SETTLE_MS / 1000,
                delay: 0.22,
                ease: [...motionTokens.ease.enter] as [number, number, number, number],
              }}
            />
          )}
        </motion.svg>
      )}
    </AnimatePresence>
  )
}
