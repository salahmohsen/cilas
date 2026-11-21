import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import {
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  FilePen,
  Files,
  Inbox,
  type LucideIcon,
  Mail,
  Presentation,
  Settings2,
  UserRound,
} from 'lucide-react'

import { isAdminUser, isFellowUser } from '@/access'
import { Badge } from '@/components/arc/badge/badge'
import { Breadcrumb } from '@/components/arc/breadcrumb/breadcrumb'
import styles from '@/components/space/space.module.css'
import { currentReader } from '@/lib/reader'
import { spacesOff } from '@/lib/spaces'
import { COMMUNITY_COVER, mySpaces } from '@/lib/spaces-data'
import { PortalEmptyState } from '@/portal/feedback/empty-state'
import { spaceLabel } from '@/portal/nav/space-links'
import type { User } from '@/payload-types'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

type Shortcut = { key: string; href: string; icon: LucideIcon; external: boolean }

/**
 * What the account can start from here, by role. The admin has its own root
 * layout, so its links load in full rather than through the client router.
 */
const shortcutsFor = (user: User, locale: string): Shortcut[] => [
  {
    key: 'writeArticle',
    href: '/admin/collections/articles/create',
    icon: FilePen,
    external: true,
  },
  { key: 'myArticles', href: '/admin/collections/articles', icon: Files, external: true },
  { key: 'editProfile', href: `/${locale}/settings`, icon: UserRound, external: false },
  ...(isFellowUser(user)
    ? [
        {
          key: 'proposeCourse',
          href: '/admin/collections/courses/create',
          icon: Presentation,
          external: true,
        },
        { key: 'myCourses', href: '/admin/collections/courses', icon: BookOpen, external: true },
      ]
    : []),
  ...(isAdminUser(user)
    ? [
        {
          key: 'applications',
          href: '/admin/collections/form-submissions',
          icon: Inbox,
          external: true,
        },
        {
          key: 'newsletter',
          href: '/admin/collections/newsletters/create',
          icon: Mail,
          external: true,
        },
        {
          key: 'siteSettings',
          href: '/admin/globals/site-settings',
          icon: Settings2,
          external: true,
        },
      ]
    : []),
]

/** Spec §2: the community first, then cohorts and courses, archived course spaces last. */
export default async function MySpacesPage({ params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)

  const payload = await getPayload({ config })
  // Off: no space exists for anyone, so only the shortcuts show (Deviation 17).
  const off = await spacesOff(payload)
  const [t, tp, ts, format, spaces] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('Portal'),
    getTranslations('SpaceShortcuts'),
    getFormatter(),
    off ? null : mySpaces(payload, user, locale),
  ])
  const sections = spaces
    ? [
        { id: 'community', label: t('community'), rows: spaces.communities },
        { id: 'cohorts', label: t('cohortSpaces'), rows: spaces.cohorts },
        {
          id: 'courses',
          label: t('courseSpaces'),
          rows: [...spaces.courses].sort((a, b) => Number(a.archived) - Number(b.archived)),
        },
      ].filter((s) => s.rows.length > 0)
    : []

  return (
    <div className={styles.page}>
      <header className={styles.plainHead}>
        <Breadcrumb items={[{ label: t('home'), href: `/${locale}` }, { label: t('title') }]} />
        <h1 className={styles.spaceTitle}>{t('title')}</h1>
      </header>
      {spaces && sections.length === 0 ? (
        <PortalEmptyState
          title={tp('empty.spacesTitle')}
          body={t('empty')}
          next={tp('empty.spacesNext')}
        />
      ) : (
        sections.map((s) => (
          <section key={s.id} aria-labelledby={`spaces-${s.id}`} className={styles.column}>
            <h2
              id={`spaces-${s.id}`}
              className={s.id === 'community' ? 'sr-only' : styles.sectionTitle}
            >
              {s.label}
            </h2>
            <ul className={styles.cards}>
              {s.rows.map((row) => (
                <li key={row.space.id} className={styles.tileItem}>
                  {/* The whole card is the link; the cover fills it under a dark tint so the name reads in both themes. */}
                  <Link href={row.href} className={styles.spaceCard}>
                    <Image
                      src={row.cover ?? COMMUNITY_COVER}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className={styles.spaceCardImage}
                    />
                    <span className={styles.spaceCardTitle}>
                      <bdi>{spaceLabel(row, t('community'))}</bdi>
                    </span>
                    <span className={styles.spaceCardFoot}>
                      <span>
                        {row.lastActivity
                          ? t('active', { time: format.relativeTime(new Date(row.lastActivity)) })
                          : t('noActivity')}
                      </span>
                      {(row.archived || row.unread > 0) && (
                        <span className={styles.spaceCardBadges}>
                          {row.archived && <Badge size="sm">{t('archived')}</Badge>}
                          {row.unread > 0 && (
                            <Badge size="sm" tone="success">
                              {t('unread')}
                            </Badge>
                          )}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <section aria-labelledby="spaces-shortcuts" className={styles.column}>
        <h2 id="spaces-shortcuts" className={styles.sectionTitle}>
          {ts('title')}
        </h2>
        {/* Actions, not places: a list of rows reads faster than a second wall of cards. */}
        <ul className={styles.shortcuts}>
          {shortcutsFor(user, locale).map(({ key, href, icon: Icon, external }) => {
            const body = (
              <>
                <span className={styles.shortcutIcon} aria-hidden="true">
                  <Icon size={18} />
                </span>
                <span className={styles.rowText}>
                  <span className={styles.shortcutTitle}>{ts(key)}</span>
                  <span className={styles.shortcutHint}>{ts(`${key}Hint`)}</span>
                </span>
                {external ? (
                  <ArrowUpRight size={16} className={styles.shortcutEnd} aria-hidden="true" />
                ) : (
                  <ChevronRight size={16} className={styles.shortcutEnd} aria-hidden="true" />
                )}
              </>
            )
            return (
              <li key={key}>
                {external ? (
                  <a href={href} className={styles.shortcut}>
                    {body}
                    <span className="sr-only">{ts('inDashboard')}</span>
                  </a>
                ) : (
                  <Link href={href} className={styles.shortcut}>
                    {body}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
