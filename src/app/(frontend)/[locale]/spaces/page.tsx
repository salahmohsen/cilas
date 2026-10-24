import config from '@payload-config'
import type { Metadata } from 'next'
import { getFormatter, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import { isFellowUser } from '@/access'
import { Badge } from '@/components/arc/badge/badge'
import { Card } from '@/components/arc/card/card'
import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { PageHeader } from '@/components/arc/page-header/page-header'
import styles from '@/components/space/space.module.css'
import { currentReader } from '@/lib/reader'
import { mySpaces } from '@/lib/spaces-data'

type Props = { params: Promise<{ locale: string }> }

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Spaces')
  return { title: t('metaTitle'), robots: { index: false } }
}

/** Spec §2: the community first, then cohorts and courses, archived course spaces last. */
export default async function MySpacesPage({ params }: Props) {
  const { locale } = await params
  const user = await currentReader()
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/spaces`)}`)

  const [t, format, { community, cohorts, courses }] = await Promise.all([
    getTranslations('Spaces'),
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
      <PageHeader
        breadcrumb={[{ label: t('home'), href: `/${locale}` }, { label: t('title') }]}
        title={t('title')}
      />
      {sections.length === 0 ? (
        <EmptyState title={t('title')} description={t('empty')} />
      ) : (
        sections.map((s) => (
          <section
            key={s.id}
            aria-labelledby={s.id === 'community' ? undefined : `spaces-${s.id}`}
            aria-label={s.id === 'community' ? s.label : undefined}
            className={styles.column}
          >
            {s.id !== 'community' && (
              <h2 id={`spaces-${s.id}`} className={styles.sectionTitle}>
                {s.label}
              </h2>
            )}
            <div className={styles.cards}>
              {s.rows.map((row) => (
                <Card
                  key={row.space.id}
                  title={row.space.kind === 'community' ? t('community') : row.title}
                  description={row.preview ?? t('noPostsYet')}
                  meta={
                    row.archived ? (
                      <Badge size="sm">{t('archived')}</Badge>
                    ) : row.unread > 0 ? (
                      <Badge size="sm" tone="info">
                        <span className={styles.numeric}>{row.unread}</span>
                        <span className="sr-only"> {t('unread')}</span>
                      </Badge>
                    ) : undefined
                  }
                  status={
                    row.lastActivity
                      ? t('active', { time: format.relativeTime(new Date(row.lastActivity)) })
                      : undefined
                  }
                  action={
                    <Link href={row.href} className={styles.link}>
                      {t('openSpace')}
                    </Link>
                  }
                />
              ))}
            </div>
          </section>
        ))
      )}
      <footer className={styles.footerLinks}>
        <Link href="/admin/collections/articles/create" className={styles.link}>
          {t('writeArticle')}
        </Link>
        {isFellowUser(user) && (
          <Link href="/admin/collections/courses/create" className={styles.link}>
            {t('proposeCourse')}
          </Link>
        )}
      </footer>
    </div>
  )
}
