import { BookOpen, Clock, MessagesSquare, Users } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import Link from 'next/link'

import buttonStyles from '@/components/arc/button/button.module.css'
import { ScrollArea } from '@/components/arc/scroll-area/scroll-area'
import type { Locale } from '@/i18n/routing'
import type { SpaceKind } from '@/lib/spaces'
import type { SpaceLink } from '@/portal/nav/space-links'
import { SpaceCover, UnreadCircle } from '@/portal/nav/space-parts'
import { useSpaceUnread } from '@/portal/nav/space-unread'
import styles from './home.module.css'

/** One card of "Your spaces": the nav row's data, what the space is, and when it last had a post. */
export type SpaceCardData = SpaceLink & { kind: SpaceKind; lastActivity: string | null }

const KIND_ICON = { community: MessagesSquare, cohort: Users, course: BookOpen } as const

function SpaceCard({ space }: { space: SpaceCardData }) {
  const t = useTranslations('Portal.home')
  const format = useFormatter()
  const count = useSpaceUnread(space.unread)
  const Kind = KIND_ICON[space.kind]
  return (
    <Link href={space.href} className={styles.spaceCard}>
      <SpaceCover src={space.cover} sizes="232px" className={styles.art!} />{' '}
      {count && (
        <span className={styles.unread}>
          <UnreadCircle shown={count.shown} />
        </span>
      )}
      <span className={styles.info}>
        <span className={styles.spaceName}>
          <bdi>{space.label}</bdi>
          {count && <span className="sr-only">{count.spoken}</span>}
        </span>{' '}
        <span className={styles.facts}>
          <span className={styles.fact}>
            <Kind size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>{t(space.archived ? 'spaceKind.archived' : `spaceKind.${space.kind}`)}</span>
          </span>{' '}
          <span className={styles.fact}>
            <Clock size={14} strokeWidth={1.75} aria-hidden="true" />
            <span>
              {space.lastActivity
                ? t('activeAgo', {
                    time: format.relativeTime(new Date(space.lastActivity), new Date()),
                  })
                : t('noPosts')}
            </span>
          </span>
        </span>
      </span>
    </Link>
  )
}

/** "Your spaces": one row of cards that scrolls sideways, from the reading start. */
export function SpacesCard({
  spaces,
  student,
  locale,
}: {
  spaces: SpaceCardData[]
  student: boolean
  locale: Locale
}) {
  const t = useTranslations('Portal.home')
  return (
    <section aria-labelledby="home-spaces" className={styles.section}>
      <h2 id="home-spaces" className={styles.heading}>
        {t('spaces')}
      </h2>
      {spaces.length ? (
        <ScrollArea
          orientation="horizontal"
          snap="x mandatory"
          fade={0}
          scrollbars="always"
          wheelToHorizontal={false}
          label={t('spacesList')}
          className={styles.scroller}
          viewportClassName={styles.scrollerViewport}
        >
          <ul className={styles.spaces} role="list">
            {spaces.map((space) => (
              <li key={space.id}>
                <SpaceCard space={space} />
              </li>
            ))}
          </ul>
        </ScrollArea>
      ) : (
        <div className={styles.noSpaces}>
          <p className={styles.empty}>{t('noSpaces')}</p>
          {student && (
            <Link
              href={`/${locale}/study`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md} ${styles.action}`}
            >
              {t('seeCourses')}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
