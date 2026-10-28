'use client'

import { Children, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import styles from './events.module.css'
import { Carousel } from '@/components/arc/carousel/carousel'

export function EventCarousel({ children, label }: { children: ReactNode; label: string }) {
  const t = useTranslations('Home.controls')
  const events = useTranslations('Events')
  return (
    <div dir="ltr" className={styles.carousel}>
      <Carousel
        label={label}
        indicators={Children.count(children) > 7 ? 'counter' : 'dots'}
        slideSize="min(88cqw, 36rem)"
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
