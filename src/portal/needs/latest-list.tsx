import { useFormatter, useTranslations } from 'next-intl'

import { NOTIFICATION_GLYPHS } from '@/components/notification-glyphs'
import { clientEnv } from '@/env.client'
import { Link } from '@/i18n/navigation'
import { isNotificationKind, NOTIFICATION_KINDS } from '@/lib/notification-kinds'
import { noteText } from '@/lib/notifications-client'
import type { StoredNotification } from '@/lib/realtime/events'
import buttonStyles from '@/components/arc/button/button.module.css'

import { LATEST_MAX_PAGES, LATEST_PAGE, type LatestPage } from './latest'
import { LatestFocus } from './latest-focus'
import styles from './needs.module.css'
import { ReadLink } from './read-link'

function Note({ note }: { note: StoredNotification }) {
  const t = useTranslations('Notifications')
  const tp = useTranslations('Portal')
  const format = useFormatter()
  const now = new Date()
  const { label, detail } = noteText(note, (kind) => t(`kinds.${kind}`))
  const unread = !note.read_at
  return (
    <>
      <span className={styles.glyph} aria-hidden="true">
        {isNotificationKind(note.kind)
          ? NOTIFICATION_GLYPHS[NOTIFICATION_KINDS[note.kind].icon]
          : null}
      </span>
      <span className={styles.text}>
        <span className={styles.noteTitle}>
          {unread && <span className="sr-only">{`${tp('latest.unread')}, `}</span>}
          {label}
        </span>{' '}
        {detail && (
          <span className={styles.noteDetail}>
            <bdi dir="auto">{detail}</bdi>
          </span>
        )}{' '}
        <time className={styles.time} dateTime={note.createdAt}>
          {format.relativeTime(new Date(note.createdAt), now)}
        </time>
      </span>
      {unread && <span className={styles.dot} aria-hidden="true" />}
    </>
  )
}

const site = new URL(clientEnv.NEXT_PUBLIC_SERVER_URL)

const notificationHref = (link: string | null | undefined) => {
  const href = link?.trim()
  if (!href) return null
  const path = /^\/(?![/\\\t\r\n])/.test(href)
  try {
    const url = new URL(href, path ? site : undefined)
    const web = url.protocol === 'http:' || url.protocol === 'https:'
    if (!web || url.origin !== site.origin) return null
    return path ? href : url.href
  } catch {
    return null
  }
}

/**
 * The newest notification rows (information, never work), as the bell shows them. A row with a valid link uses
 * its stored URL, as a plain `<a>` (a soft navigation to a post from outside
 * the rooms shows the dialog over an empty page). An unread row marks itself read when opened.
 */
export function LatestList({ page, focus }: { page: LatestPage; focus: boolean }) {
  const t = useTranslations('Portal')
  const { rows, pages, more } = page
  const firstNewIndex = LATEST_PAGE * (pages - 1)
  return (
    <>
      {rows.length === 0 ? (
        <p className={styles.empty}>{t('latest.empty')}</p>
      ) : (
        <ol className={styles.rows}>
          {rows.map((note) => {
            const href = notificationHref(note.link)
            const className = `${styles.note} ${note.read_at ? '' : styles.unread}`
            return (
              <li key={note.id}>
                {href === null ? (
                  <div className={className}>
                    <Note note={note} />
                  </div>
                ) : note.read_at ? (
                  <a href={href} className={className}>
                    <Note note={note} />
                  </a>
                ) : (
                  <ReadLink href={href} id={note.id} className={className}>
                    <Note note={note} />
                  </ReadLink>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {more === 'link' && (
        <Link
          href={`/spaces/inbox?latest=${pages + 1}&focus=latest`}
          scroll={false}
          className={`${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md} ${styles.more}`}
        >
          {t('latest.showMore')}
        </Link>
      )}
      {more === 'cap' && (
        <p className={styles.cap}>{t('latest.cap', { count: LATEST_PAGE * LATEST_MAX_PAGES })}</p>
      )}
      <LatestFocus
        focus={focus && pages > 1}
        firstNewIndex={firstNewIndex}
        message={t('latest.moreRows', { count: rows.length - firstNewIndex })}
      />
    </>
  )
}
