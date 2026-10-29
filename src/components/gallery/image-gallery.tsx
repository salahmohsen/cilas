'use client'

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

import { Lightbox } from '@/components/interior/lightbox'
import type { GalleryBlock } from '@/payload-types'
import { focalPointStyle } from '@/lib/media-image'
import styles from './image-gallery.module.css'

export function ImageGallery({ images = [], columnCount = '3' }: GalleryBlock) {
  const t = useTranslations('Gallery')
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)
  const thumbnails = useRef<(HTMLAnchorElement | null)[]>([])
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
            <a
              ref={(element) => {
                thumbnails.current[index] = element
              }}
              href={src}
              className={styles.thumbnail}
              aria-label={t('open', { alt: image.alt })}
              aria-haspopup="dialog"
              onClick={(event) => {
                if (
                  event.defaultPrevented ||
                  event.button !== 0 ||
                  event.metaKey ||
                  event.ctrlKey ||
                  event.shiftKey ||
                  event.altKey
                )
                  return
                event.preventDefault()
                originRef.current = event.currentTarget
                returnFocusRef.current = event.currentTarget
                setActiveIndex(index)
                setOpen(true)
              }}
            >
              <Image
                src={src}
                alt={image.alt}
                fill
                sizes={`auto, (max-width: 48rem) 100vw, ${Math.ceil(100 / Number(columnCount))}vw`}
                style={focalPointStyle(image)}
                loading="lazy"
                decoding="async"
              />
            </a>
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
