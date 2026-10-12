'use client'

import { useTranslations } from 'next-intl'

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
  return (
    <div className="poster-carousel" dir="ltr">
      <Carousel
        autoplay
        interval={INTERVAL}
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
        slideSize="min(100cqw, 75rem)"
      >
        {posters.map((poster) => (
          <div className="poster-frame" dir="auto" key={poster.id}>
            <Poster poster={poster} />
          </div>
        ))}
      </Carousel>
    </div>
  )
}
