import { ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { localDigits } from '@/lib/digits'

import styles from './needs.module.css'
import type { NeedKind, NeedRow } from './sources'

type Shown = Pick<NeedRow, 'kind' | 'href' | 'count' | 'owners' | 'label' | 'collection'> & {
  verbKey: string
}

const GROUPED_VERB = {
  review: 'needs.grouped.review',
  edit_review: 'needs.grouped.editReview',
  removal_review: 'needs.grouped.removalReview',
  changes_requested: 'needs.grouped.changesRequested',
} as const satisfies Partial<Record<NeedKind, `needs.grouped.${string}`>>

const REVIEW_PAGE = '/admin/reviews'

/** One row per kind with the sum of `count`; the applicants row stays as it is. The row links to the list of its kind. */
const grouped = (rows: NeedRow[], locale: string): Shown[] => {
  const byKind = new Map<NeedKind, NeedRow[]>()
  for (const row of rows) byKind.set(row.kind, [...(byKind.get(row.kind) ?? []), row])
  return [...byKind].map(([kind, of]): Shown => {
    if (kind === 'applicants') return of[0]!
    const owns = (collection: string) => of.some((row) => row.collection === collection)
    const href =
      kind === 'changes_requested'
        ? `/${locale}/spaces/${owns('articles') ? 'articles' : 'courses'}?show=needsYou`
        : REVIEW_PAGE
    return {
      kind,
      verbKey: GROUPED_VERB[kind],
      href,
      count: of.reduce((sum, row) => sum + row.count, 0),
      owners: [],
      label: null,
      collection: null,
    }
  })
}

/**
 * The work that waits on the reader: one link per row, under a heading with the
 * total. `group` (Home, past five rows) shows one row per kind. A row runs no
 * action in place.
 */
export function NeedList({ rows, group }: { rows: NeedRow[]; group: boolean }) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  const shown: Shown[] = group ? grouped(rows, locale) : rows
  const untitled = (collection: NeedRow['collection']) =>
    t(
      collection === 'courses'
        ? 'needs.untitledCourse'
        : collection === 'publications'
          ? 'needs.untitledPublication'
          : 'needs.untitledArticle',
    )
  return (
    <section className={styles.section} data-needs>
      <h2 className={styles.heading}>
        {t('needs.heading')}
        <span className={styles.total}>{localDigits(total, locale)}</span>
      </h2>
      <ul className={styles.rows}>
        {shown.map((row) => (
          <li key={`${row.kind}:${row.href}`}>
            <a href={row.href} className={styles.need} data-need-kind={row.kind}>
              <span className={styles.text}>
                <span className={styles.verb}>
                  {t(row.verbKey as 'needs.review', { count: row.count })}
                </span>{' '}
                {row.kind !== 'applicants' && row.label !== null && (
                  <span className={styles.label}>
                    <bdi dir="auto">{row.label}</bdi>
                  </span>
                )}{' '}
                {row.kind !== 'applicants' && row.label === null && !group && (
                  <span className={styles.label}>{untitled(row.collection)}</span>
                )}{' '}
                {row.owners.length > 0 && (
                  <span className={styles.owners}>
                    {t('needs.owners', { names: row.owners.join(', ') })}
                  </span>
                )}
              </span>
              <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className={styles.go} />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}
