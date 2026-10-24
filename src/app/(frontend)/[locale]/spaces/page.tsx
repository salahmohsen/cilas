import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import {
  BookOpen,
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
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import styles from '@/components/space/space.module.css'
import { currentReader } from '@/lib/reader'
import { mySpaces } from '@/lib/spaces-data'
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
  { key: 'editProfile', href: `/${locale}/profile`, icon: UserRound, external: false },
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

  const [t, ts, format, { community, cohorts, courses }] = await Promise.all([
    getTranslations('Spaces'),
    getTranslations('SpaceShortcuts'),
    getFormatter(),
    mySpaces(await getPayload({ config }), user, locale),
  ])
  const sections = [
    { id: 'community', label: t('community'), rows: community ? [community] : [] },
    { id: 'cohorts', label: t('cohort'), rows: cohorts },
    {
      id: 'courses',
      label: t('course'),
      rows: [...courses].sort((a, b) => Number(a.archived) - Number(b.archived)),
    },
  ].filter((s) => s.rows.length > 0)

  return (
    <div className={styles.page}>
      <header className={styles.spaceHead}>
        <Breadcrumb items={[{ label: t('home'), href: `/${locale}` }, { label: t('title') }]} />
        <h1 className={styles.spaceTitle}>{t('title')}</h1>
      </header>
      {sections.length === 0 ? (
        <EmptyState title={t('title')} description={t('empty')} />
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
                  <Link href={row.href} className={styles.tile}>
                    <span className={styles.tileTitle}>
                      <bdi>{row.space.kind === 'community' ? t('community') : row.title}</bdi>
                    </span>
                    <span dir="auto" className={styles.tileText}>
                      {row.preview ?? t('noPostsYet')}
                    </span>
                    <span className={styles.tileMeta}>
                      {row.archived ? (
                        <Badge size="sm">{t('archived')}</Badge>
                      ) : row.unread > 0 ? (
                        <Badge size="sm" tone="info">
                          <span className={styles.numeric}>{row.unread}</span>
                          <span className="sr-only"> {t('unread')}</span>
                        </Badge>
                      ) : null}
                      {row.lastActivity && (
                        <span>
                          {t('active', { time: format.relativeTime(new Date(row.lastActivity)) })}
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
        <ul className={styles.cards}>
          {shortcutsFor(user, locale).map(({ key, href, icon: Icon, external }) => {
            const body = (
              <>
                <span className={styles.tileIcon} aria-hidden="true">
                  <Icon size={20} />
                </span>
                <span className={styles.tileTitle}>{ts(key)}</span>
                <span className={styles.tileText}>{ts(`${key}Hint`)}</span>
              </>
            )
            return (
              <li key={key} className={styles.tileItem}>
                {external ? (
                  <a href={href} className={styles.tile}>
                    {body}
                  </a>
                ) : (
                  <Link href={href} className={styles.tile}>
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
