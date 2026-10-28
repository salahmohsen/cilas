'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'

import { Lightbox } from '@/components/interior/lightbox'
import type { GalleryBlock } from '@/payload-types'
import styles from './image-gallery.module.css'

export function ImageGallery({ images = [], columnCount = '3' }: GalleryBlock) {
  const t = useTranslations('Gallery')
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const thumbnails = useRef<(HTMLButtonElement | null)[]>([])
  const originRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  const shots = images.flatMap(({ image, caption, id }) => {
    if (!image || typeof image !== 'object' || !image.url) return []
    if (image.mimeType && !image.mimeType.startsWith('image/')) return []
    return [{ image, src: image.url, caption: caption || undefined, id }]
  })

  if (!shots.length) return null
  const currentIndex = Math.min(activeIndex, shots.length - 1)
  const active = shots[currentIndex]
  const navigate = (offset: number) => {
    const index = (currentIndex + offset + shots.length) % shots.length
    originRef.current = thumbnails.current[index]
    setActiveIndex(index)
  }

  return (
    <div className={`${styles.gallery} not-prose`}>
      <div className={styles.grid} data-gallery-columns={columnCount}>
        {shots.map(({ image, src, caption, id }, index) => (
          <figure key={id ?? index} className={styles.figure}>
            <button
              ref={(element) => {
                thumbnails.current[index] = element
              }}
              type="button"
              className={styles.thumbnail}
              aria-label={t('open', { alt: image.alt })}
              aria-haspopup="dialog"
              onClick={(event) => {
                originRef.current = event.currentTarget
                returnFocusRef.current = event.currentTarget
                setActiveIndex(index)
                setOpen(true)
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.sizes?.thumbnail?.url || src}
                alt={image.alt}
                width={image.sizes?.thumbnail?.width ?? image.width ?? undefined}
                height={image.sizes?.thumbnail?.height ?? image.height ?? undefined}
                loading="lazy"
                decoding="async"
              />
            </button>
            {caption && (
              <figcaption className={styles.caption} dir="auto">
                {caption}
              </figcaption>
            )}
          </figure>
        ))}
      </div>
      <Lightbox
        open={open}
        onClose={() => setOpen(false)}
        src={active.src}
        alt={active.image.alt}
        caption={active.caption}
        width={active.image.width ?? undefined}
        height={active.image.height ?? undefined}
        originRef={originRef}
        returnFocusRef={returnFocusRef}
        position={t('position', { current: currentIndex + 1, total: shots.length })}
        onPrevious={shots.length > 1 ? () => navigate(-1) : undefined}
        onNext={shots.length > 1 ? () => navigate(1) : undefined}
      />
    </div>
  )
}
