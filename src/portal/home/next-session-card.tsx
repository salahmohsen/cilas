import { useTranslations } from 'next-intl'
import Image from 'next/image'
import Link from 'next/link'

import type { AdminView } from '@/access'
import buttonStyles from '@/components/arc/button/button.module.css'
import type { Locale } from '@/i18n/routing'
import { CAIRO, cairoInstant, cairoNoon } from '@/lib/cairo-day'
import { numberingSystemOf } from '@/lib/digits'
import { focalPointStyle } from '@/lib/media-image'
import type { NextSession } from './next-session'
import styles from './home.module.css'

const BROWSE_SPACES = { href: '/spaces/community', label: 'browseSpaces' } as const

const EMPTY_ACTIONS = {
  student: { href: '/study', label: 'seeCourses' },
  fellow: { href: '/spaces/courses', label: 'openCourses' },
  admin: { href: '/spaces/calendar', label: 'openCalendar' },
} as const

export function NextSessionCard({
  session,
  view,
  browse,
  locale,
}: {
  session: NextSession | null
  view: AdminView | null
  /** The student can open a community: "Browse spaces" has a page to go to. */
  browse: boolean
  locale: Locale
}) {
  const t = useTranslations('Portal.home')
  const action = !view ? null : view === 'student' && browse ? BROWSE_SPACES : EMPTY_ACTIONS[view]
  const instant = session?.start ? cairoInstant(session.date, session.start) : null
  const title =
    session?.sessionTitle ??
    (session?.session === undefined
      ? session?.title
      : t('sessionNumber', { number: session.session }))
  const content = session && (
    <>
      {session.cover && (
        <Image
          src={session.cover.url}
          alt=""
          fill
          sizes="(min-width: 1240px) 880px, 100vw"
          className={styles.coverImage}
          style={focalPointStyle(session.cover)}
        />
      )}
      <span className={styles.sessionTitle}>
        <bdi>{title}</bdi>
      </span>
      {session.title !== title && (
        <span>
          <bdi>{session.title}</bdi>
        </span>
      )}
      <time dateTime={instant ?? session.date}>
        {new Intl.DateTimeFormat(locale, {
          dateStyle: 'long',
          ...(instant ? { timeStyle: 'short' } : {}),
          timeZone: CAIRO,
          numberingSystem: numberingSystemOf(locale),
        }).format(instant ? new Date(instant) : cairoNoon(session.date))}
      </time>
    </>
  )
  return (
    <section aria-labelledby="home-next-session" className={styles.section}>
      <h2 id="home-next-session" className={styles.heading}>
        {t('nextSession')}
      </h2>
      {session ? (
        session.href ? (
          <Link href={session.href} className={styles.sessionTile}>
            {content}
          </Link>
        ) : (
          <div className={styles.sessionTile}>{content}</div>
        )
      ) : (
        <>
          <p className={styles.empty}>{t('noSession')}</p>
          {action && (
            <Link
              href={`/${locale}${action.href}`}
              className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md} ${styles.action}`}
            >
              {t(action.label)}
            </Link>
          )}
        </>
      )}
    </section>
  )
}
