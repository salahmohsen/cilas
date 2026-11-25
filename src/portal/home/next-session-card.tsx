import { useTranslations } from 'next-intl'
import Link from 'next/link'

import type { AdminView } from '@/access'
import buttonStyles from '@/components/arc/button/button.module.css'
import type { Locale } from '@/i18n/routing'
import { cairoInstant, cairoNoon } from '@/lib/cairo-day'
import { focalPointStyle } from '@/lib/media-image'
import { SpaceCover } from '@/portal/nav/space-parts'
import { cairoFormat, meetingHeading } from './meeting-words'
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
  const title = session && meetingHeading(session, (number) => t('sessionNumber', { number }))
  const content = session && (
    <>
      {instant && (
        <time className={styles.clock} dateTime={instant}>
          {cairoFormat(locale, { timeStyle: 'short' }, new Date(instant))}
        </time>
      )}{' '}
      <span className={styles.sessionTitle}>
        <bdi>{title}</bdi>
      </span>{' '}
      <span className={styles.sessionMeta}>
        {session.title !== title && (
          <span>
            <bdi>{session.title}</bdi>
          </span>
        )}{' '}
        <time dateTime={session.date}>
          {cairoFormat(
            locale,
            { dateStyle: 'long' },
            instant ? new Date(instant) : cairoNoon(session.date),
          )}
        </time>
      </span>
    </>
  )
  return (
    <section aria-labelledby="home-next-session" className={styles.next}>
      {session?.cover && (
        <SpaceCover
          src={session.cover.url}
          sizes="(min-width: 1240px) 640px, 100vw"
          className={styles.nextCover!}
          imageStyle={focalPointStyle(session.cover)}
        >
          <span className={styles.scrim} />
        </SpaceCover>
      )}
      <h2 id="home-next-session" className={styles.chip}>
        {t('nextSession')}
      </h2>
      {session ? (
        session.href ? (
          <Link href={session.href} className={styles.hero}>
            {content}
          </Link>
        ) : (
          <div className={styles.hero}>{content}</div>
        )
      ) : (
        <div className={styles.hero}>
          <p className={styles.sessionTitle}>{t('noSession')}</p>
          {action && (
            <Link
              href={`/${locale}${action.href}`}
              className={`${buttonStyles.button} ${buttonStyles.md} ${styles.onDark}`}
            >
              {t(action.label)}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}
