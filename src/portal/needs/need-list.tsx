import { ChevronRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { localeOf, type Locale } from '@/i18n/routing'
import { localDigits } from '@/lib/digits'
import { DEFAULT_PARAMS, hrefOf } from '@/portal/lists/list-params'

import styles from './needs.module.css'
import { needsTotal, type NeedKind, type NeedRow, type NeedsResult } from './sources'

type Shown = NeedRow & {
  collectionLabel?: 'nav.articles' | 'nav.courses'
}

const GROUPED_VERB = {
  review: 'needs.grouped.review',
  edit_review: 'needs.grouped.editReview',
  removal_review: 'needs.grouped.removalReview',
  changes_requested: 'needs.grouped.changesRequested',
} as const satisfies Partial<Record<NeedKind, `needs.grouped.${string}`>>

const REVIEW_PAGE = '/admin/reviews'

/** Group by kind and destination so each count describes the work its link opens. */
const grouped = (rows: NeedRow[], locale: Locale): Shown[] => {
  const groups = new Map<string, Shown>()
  for (const row of rows) {
    const { kind, collection } = row
    if (kind === 'applicants') {
      if (!groups.has(kind)) groups.set(kind, row)
      continue
    }
    const list =
      kind === 'changes_requested' && (collection === 'articles' || collection === 'courses')
        ? collection
        : null
    const href = list
      ? hrefOf(`/spaces/${list}`, { ...DEFAULT_PARAMS, show: 'needsYou' }, locale)
      : REVIEW_PAGE
    const key = `${kind}:${href}`
    const existing = groups.get(key)
    if (existing) {
      existing.count += row.count
      continue
    }
    groups.set(key, {
      kind,
      verbKey: GROUPED_VERB[kind],
      href,
      count: row.count,
      owners: [],
      label: null,
      collection: list,
      collectionLabel: list ? `nav.${list}` : undefined,
    })
  }
  return [...groups.values()]
}

/**
 * The work that waits on the reader: one link per row, under a heading with the
 * total. `group` (Home, past five rows) combines rows of the same kind that
 * link to the same destination.
 */
export function NeedList({ result, group }: { result: NeedsResult; group: boolean }) {
  const { rows } = result
  const total = needsTotal(result)
  const t = useTranslations('Portal')
  const locale = localeOf(useLocale())
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
        {total !== null && total > 0 && (
          <span className={styles.total}>{localDigits(total, locale)}</span>
        )}
      </h2>
      {total === null && (
        <p className={styles.notice} role="status">
          {t('needs.someFailed')}
        </p>
      )}
      {total === 0 && <p className={styles.empty}>{t('needs.empty')}</p>}
      {shown.length > 0 && (
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
                  {row.collectionLabel && (
                    <span className={styles.label}>{t(row.collectionLabel)}</span>
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
                <ChevronRight
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                  className={styles.go}
                />
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
