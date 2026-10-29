'use client'

import { Children, useSyncExternalStore, type ReactNode } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Carousel } from '@/components/arc/carousel/carousel'
import styles from '@/components/rich-text-columns.module.css'

const MOBILE = '(width < 48rem)'
const serverSnapshot = () => false
const mobileSnapshot = () => window.matchMedia?.(MOBILE).matches ?? false
const subscribe = (notify: () => void) => {
  const query = window.matchMedia?.(MOBILE)
  query?.addEventListener('change', notify)
  return () => query?.removeEventListener('change', notify)
}

export function ProfileColumns({
  children,
  columnCount,
  ratio,
}: {
  children: ReactNode
  columnCount: number
  ratio?: string | null
}) {
  const mobile = useSyncExternalStore(subscribe, mobileSnapshot, serverSnapshot)
  const locale = useLocale()
  const t = useTranslations('Person')
  const controls = useTranslations('Home.controls')
  if (!mobile) {
    return (
      <div
        className={styles.columns}
        data-columns={columnCount}
        data-ratio={ratio}
        data-profile-carousel
      >
        {children}
      </div>
    )
  }
  return (
    <div className={styles.profileCarousel} data-profile-carousel dir="ltr">
      <Carousel
        label={t('profiles')}
        autoplay={false}
        slideSize="88cqw"
        controlsAt="start"
        labels={{
          slides: t('profiles'),
          previous: controls('previous'),
          next: controls('next'),
          choose: t('chooseProfile'),
        }}
        slideLabel={(index, count) => controls('position', { position: index + 1, total: count })}
      >
        {Children.map(children, (child) => (
          <div className={styles.profileSlide} dir={locale === 'ar' ? 'rtl' : 'ltr'}>
            {child}
          </div>
        ))}
      </Carousel>
    </div>
  )
}
