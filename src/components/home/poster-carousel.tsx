'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'

import { Carousel } from '@/components/arc/carousel/carousel'
import { Poster, type PosterData } from '@/components/home/poster'

/** How long each poster stays before the next. */
const INTERVAL = 7000

/**
 * Posters one at a time, turning on their own and starting over after the
 * last. Rotation stops on hover or focus, has a pause button, and stays off
 * with reduced motion. The carousel moves left to right in both languages;
 * each poster keeps its own direction.
 */
export function PosterCarousel({ posters, label }: { posters: PosterData[]; label: string }) {
  const t = useTranslations('Home.controls')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const activeIndex = Math.min(selectedIndex, Math.max(0, posters.length - 1))
  const nextIndex = posters.length ? (activeIndex + 1) % posters.length : 0
  return (
    <div className="poster-carousel" dir="ltr">
      <Carousel
        autoplay
        interval={INTERVAL}
        index={activeIndex}
        onIndexChange={setSelectedIndex}
        label={label}
        labels={{
          slides: label,
          pause: t('pauseRotation'),
          play: t('startRotation'),
          choose: t('choose'),
          previous: t('previous'),
          next: t('next'),
        }}
        slideLabel={(i, count) => t('position', { position: i + 1, total: count })}
        slideSize="100cqw"
      >
        {posters.map((poster, index) => (
          <div className="poster-frame" dir="auto" key={poster.id}>
            <Poster
              poster={poster}
              imageLoading={index === activeIndex || index === nextIndex ? 'eager' : 'lazy'}
              imageFetchPriority={index === activeIndex ? 'high' : 'auto'}
            />
          </div>
        ))}
      </Carousel>
    </div>
  )
}
