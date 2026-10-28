'use client'

import { Children, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import styles from './events.module.css'
import { Carousel } from '@/components/arc/carousel/carousel'

export function EventCarousel({ children, label }: { children: ReactNode; label: string }) {
  const t = useTranslations('Home.controls')
  const events = useTranslations('Events')
  const count = Children.count(children)
  return (
    <div dir="ltr" className={styles.carousel}>
      <Carousel
        label={label}
        defaultIndex={count > 2 ? 1 : 0}
        indicators={count > 7 ? 'counter' : 'dots'}
        slideSize="var(--event-slide-size)"
        controlsAt="start"
        labels={{
          slides: label,
          previous: t('previous'),
          next: t('next'),
          choose: events('choose'),
          pause: t('pauseRotation'),
          play: t('startRotation'),
        }}
        slideLabel={(index, count) => t('position', { position: index + 1, total: count })}
      >
        {children}
      </Carousel>
    </div>
  )
}
