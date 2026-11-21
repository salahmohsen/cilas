import Image from 'next/image'
import type { getFormatter, getTranslations } from 'next-intl/server'

import { Badge } from '@/components/arc/badge/badge'
import { courseTypeKey } from '@/fields/course-type'
import type { Locale } from '@/i18n/routing'
import { localDigits, numberingSystemOf } from '@/lib/digits'
import { documentHref } from '@/lib/document-href'
import { nextAction, statusBadge, waitsOn } from '@/lib/review-status'

import styles from './lists.module.css'
import type { ListRow } from './rows'
import { STATUS_ICONS } from './status-icons'

export type PortalTranslator = Awaited<ReturnType<typeof getTranslations<'Portal'>>>
export type StudyFiltersTranslator = Awaited<ReturnType<typeof getTranslations<'Study.filters'>>>
export type Formatter = Awaited<ReturnType<typeof getFormatter>>

export type RowIntl = {
  t: PortalTranslator
  tStudy: StudyFiltersTranslator
  format: Formatter
  locale: Locale
  now: Date
}

const DAY = 86_400_000

const articleMeta = (row: ListRow, viewer: 'owner' | 'admin', intl: RowIntl): string[] => {
  const { t, format, locale, now } = intl
  const when = format.relativeTime(new Date(row.updatedAt), {
    now,
    numberingSystem: numberingSystemOf(locale),
  })
  const parts = [t('lists.meta.updated', { when }), row.tier && t(`lists.tier.${row.tier}`)]
  if (viewer === 'admin') {
    if (row.owners.length > 0) parts.push(format.list(row.owners))
    if (row.waitingSince) {
      const days = Math.floor((now.getTime() - new Date(row.waitingSince).getTime()) / DAY)
      parts.push(t('lists.meta.waiting', { days: Math.max(0, days) }))
    }
  }
  return parts.filter((part): part is string => Boolean(part))
}

const courseMeta = (course: NonNullable<ListRow['course']>, intl: RowIntl): string[] => {
  const { t, tStudy, locale } = intl
  const season = course.season && tStudy(`seasons.${course.season}`)
  const year = course.year === null ? null : localDigits(course.year, locale)
  const when = [season, year].filter(Boolean).join(' ')
  return [
    course.type && tStudy(courseTypeKey(course.type)),
    when,
    course.total > 0 && t('lists.meta.held', { held: course.held, total: course.total }),
  ].filter((part): part is string => Boolean(part))
}

/**
 * One row of a portal list: the 40x40 slot, the title (the row's one
 * link, to the admin page), the meta line, the badges and, when the row
 * waits on the viewer or the owner has a line, the next action. A course
 * row has no applicant or Participants link (their pages ship later).
 */
export function ListRowBody({
  row,
  viewer,
  ...intl
}: { row: ListRow; viewer: 'owner' | 'admin' } & RowIntl): React.JSX.Element {
  const { t, locale } = intl
  const title =
    row.title ?? t(row.collection === 'articles' ? 'lists.untitledArticle' : 'lists.untitledCourse')
  const href = documentHref({
    collection: row.collection,
    id: row.id,
    viewer,
    waiting: waitsOn(row.key) === 'admin',
    locale,
  })
  const meta = row.course ? courseMeta(row.course, intl) : articleMeta(row, viewer, intl)
  const next = nextAction(row.key, viewer)
  return (
    <li className={styles.row}>
      <span className={styles.slot} data-slot>
        {row.cover && <Image src={row.cover} alt="" fill sizes="40px" />}
      </span>
      <div className={styles.body}>
        <a href={href} className={styles.title} dir="auto">
          <bdi>{title}</bdi>
        </a>
        {meta.length > 0 && (
          <p className={styles.meta} data-meta>
            {meta.join(' · ')}
          </p>
        )}
        <div className={styles.badges}>
          {statusBadge(row.key).map((badge) => {
            const Icon = STATUS_ICONS[badge.icon]
            return (
              <Badge
                key={badge.labelKey}
                tone={badge.tone}
                size="sm"
                icon={<Icon size={12} strokeWidth={2} aria-hidden="true" />}
                data-status-badge
              >
                {t(badge.labelKey)}
              </Badge>
            )
          })}
        </div>
        {next && (
          <p className={styles.next} data-next-action>
            {t(next.labelKey)}
          </p>
        )}
      </div>
    </li>
  )
}
