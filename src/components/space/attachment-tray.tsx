'use client'

import { useEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Paperclip, X } from 'lucide-react'

import { motionTokens } from '@/components/arc/lib/motion-tokens'

import styles from './space.module.css'

const fade = { duration: motionTokens.duration.instant }

/**
 * The files picked in a composer, under it: an image as a thumbnail, any
 * other file as a chip, each with its own remove button.
 */
export function AttachmentTray({
  files,
  onRemove,
}: {
  files: File[]
  onRemove: (file: File) => void
}) {
  const t = useTranslations('SpacePhotos')
  const reduced = useReducedMotion()
  if (!files.length) return null

  return (
    <ul className={styles.tray} aria-label={t('attachments')}>
      <AnimatePresence initial={false}>
        {files.map((file) => {
          const image = file.type.startsWith('image/')
          const remove = (
            <button
              type="button"
              className={styles.trayRemove}
              aria-label={t('remove', { name: file.name })}
              onClick={() => onRemove(file)}
            >
              <X size={12} aria-hidden="true" />
            </button>
          )
          return (
            <motion.li
              key={`${file.name}-${file.size}-${file.lastModified}`}
              layout={!reduced}
              className={image ? styles.trayThumb : styles.trayChip}
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={
                reduced
                  ? { opacity: 0, transition: fade }
                  : { opacity: 0, scale: 0.9, transition: fade }
              }
              transition={reduced ? fade : motionTokens.spring.snappy}
            >
              {image ? (
                <Preview file={file} />
              ) : (
                <>
                  <Paperclip size={14} aria-hidden="true" />
                  <bdi>{file.name}</bdi>
                </>
              )}
              {remove}
            </motion.li>
          )
        })}
      </AnimatePresence>
    </ul>
  )
}

/** An image the member picked, shown from memory before upload. The URL lives as long as the element. */
function Preview({ file }: { file: File }) {
  const img = useRef<HTMLImageElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(file)
    if (img.current) img.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])
  // eslint-disable-next-line @next/next/no-img-element
  return <img ref={img} alt={file.name} />
}
