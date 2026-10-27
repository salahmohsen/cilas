import { getTranslations } from 'next-intl/server'

import { Skeleton } from '@/components/arc/skeleton/skeleton'
import styles from './space.module.css'

export async function SpaceLoading() {
  const t = await getTranslations('Spaces')

  return (
    <div className={styles.page} role="status" aria-label={t('loading')} aria-busy="true">
      <div className={`${styles.spaceHead} ${styles.loadingCover}`} aria-hidden="true">
        <div className={styles.headInner}>
          <Skeleton lines={1} className={styles.loadingBack} />
          <div className={styles.titleBlock}>
            <div className={styles.titleRow}>
              <Skeleton lines={1} className={styles.loadingTitle} />
              <Skeleton lines={1} className={styles.loadingBadge} />
            </div>
            <Skeleton avatar lines={1} className={styles.loadingMembers} />
          </div>
          <div className={styles.headActions}>
            <div className={styles.loadingControls}>
              <Skeleton lines={1} />
              <Skeleton lines={1} />
              <Skeleton lines={1} />
            </div>
          </div>
        </div>
      </div>
      <div className={styles.layout} aria-hidden="true">
        <div className={styles.feed}>
          <div className={styles.loadingComposer}>
            <Skeleton avatar lines={1} className={styles.loadingByline} />
          </div>
          <div className={styles.loadingControls}>
            <Skeleton lines={1} />
            <Skeleton lines={1} />
            <Skeleton lines={1} />
          </div>
          <div className={styles.pinnedSection}>
            <div className={styles.pinnedHead}>
              <Skeleton lines={1} className={styles.loadingBack} />
            </div>
            <div className={styles.pinnedRow}>
              {[0, 1, 2].map((card) => (
                <div key={card} className={`${styles.pinnedCard} ${styles.loadingPinned}`}>
                  <Skeleton lines={3} />
                  <Skeleton avatar lines={2} className={styles.loadingByline} />
                </div>
              ))}
            </div>
          </div>
          {[3, 4, 2].map((lines) => (
            <div key={lines} className={styles.post}>
              <Skeleton avatar lines={2} className={styles.loadingByline} />
              <Skeleton lines={lines} />
              <div className={styles.postFoot}>
                <Skeleton lines={1} className={styles.loadingPostActions} />
                <Skeleton lines={1} className={styles.loadingBadge} />
              </div>
            </div>
          ))}
        </div>
        <div className={styles.rail}>
          <div className={styles.group}>
            <div className={styles.groupHead}>
              <Skeleton lines={1} className={styles.loadingBack} />
            </div>
            <div className={styles.groupBody}>
              <Skeleton lines={4} />
            </div>
            {[0, 1, 2].map((row) => (
              <div key={row} className={`${styles.row} ${styles.loadingRailRow}`}>
                <Skeleton lines={1} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export async function MySpacesLoading() {
  const t = await getTranslations('Spaces')

  return (
    <div className={styles.page} role="status" aria-label={t('loading')} aria-busy="true">
      <header className={styles.plainHead} aria-hidden="true">
        <Skeleton lines={1} className={styles.loadingBack} />
        <h1 className={styles.spaceTitle}>{t('title')}</h1>
      </header>
      {[1, 2, 3].map((count) => (
        <div key={count} className={styles.column} aria-hidden="true">
          <Skeleton lines={1} className={styles.loadingMembers} />
          <div className={styles.cards}>
            {Array.from({ length: count }, (_, card) => (
              <div
                key={card}
                className={`${styles.spaceCard} ${styles.loadingCover} ${styles.loadingTile}`}
              >
                <Skeleton lines={2} />
                <Skeleton lines={1} className={styles.loadingTileFoot} />
              </div>
            ))}
          </div>
        </div>
      ))}
      <div className={styles.column} aria-hidden="true">
        <Skeleton lines={1} className={styles.loadingMembers} />
        <div className={styles.shortcuts}>
          {[0, 1, 2, 3].map((row) => (
            <div key={row} className={styles.loadingShortcut}>
              <Skeleton avatar lines={2} className={styles.loadingByline} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
