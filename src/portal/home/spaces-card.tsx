import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'

import { Badge } from '@/components/arc/badge/badge'
import buttonStyles from '@/components/arc/button/button.module.css'
import type { Locale } from '@/i18n/routing'
import { unreadCount } from '@/lib/unread-count'
import type { SpaceLink } from '@/portal/nav/space-links'
import styles from './home.module.css'

export function SpacesCard({
  spaces,
  student,
  locale,
}: {
  spaces: SpaceLink[]
  student: boolean
  locale: Locale
}) {
  const t = useTranslations('Portal.home')
  const nav = useTranslations('Portal.nav')
  return (
    <section aria-labelledby="home-spaces" className={styles.section}>
      <h2 id="home-spaces" className={styles.heading}>
        {t('spaces')}
      </h2>
      {spaces.length ? (
        <ul className={styles.spaces} role="list">
          {spaces.map((space) => {
            const count = space.unread
              ? unreadCount(space.unread, locale, {
                  some: (values) => nav('unread', values),
                  many: (values) => nav('unreadMany', values),
                })
              : null
            return (
              <li key={space.id}>
                <Link href={space.href} className={styles.spaceTile}>
                  {space.cover && (
                    <Image
                      src={space.cover}
                      alt=""
                      fill
                      sizes="232px"
                      className={styles.coverImage}
                    />
                  )}
                  <span>
                    <bdi>{space.label}</bdi>
                    {count && <span className="sr-only">{count.spoken}</span>}
                  </span>
                  {count && (
                    <Badge className={styles.unread} tone="danger" size="sm" aria-hidden="true">
                      {count.shown}
                    </Badge>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      ) : (
        <>
          <p className={styles.empty}>{t('noSpaces')}</p>
          {student && (
            <Link
              href={`/${locale}/study`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md} ${styles.action}`}
            >
              {t('seeCourses')}
            </Link>
          )}
        </>
      )}
    </section>
  )
}
