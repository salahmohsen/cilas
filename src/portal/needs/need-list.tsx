import {
  ArchiveX,
  ChevronRight,
  FileClock,
  FileSearch,
  PenLine,
  UserPlus,
  type LucideIcon,
} from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useId } from 'react'

import { localeOf, type Locale } from '@/i18n/routing'
import { localDigits } from '@/lib/digits'
import { Announce } from '@/portal/feedback/announce'
import { DEFAULT_PARAMS, hrefOf } from '@/portal/lists/list-params'

import styles from './needs.module.css'
import { needsTotal, type NeedKind, type NeedRow, type NeedsResult } from './sources'

type Shown = NeedRow & {
  collectionLabel?: 'nav.articles' | 'nav.courses'
  /** The titles a grouped row stands for; a single row has its own `label`. */
  items?: (string | null)[]
}

const GROUPED_VERB = {
  review: 'needs.grouped.review',
  edit_review: 'needs.grouped.editReview',
  removal_review: 'needs.grouped.removalReview',
  changes_requested: 'needs.grouped.changesRequested',
} as const satisfies Partial<Record<NeedKind, `needs.grouped.${string}`>>

/** The icon of each kind's tile, and its tone. */
const KIND_LOOK = {
  review: { Icon: FileSearch, tone: 'neutral' },
  edit_review: { Icon: FileClock, tone: 'neutral' },
  removal_review: { Icon: ArchiveX, tone: 'warning' },
  applicants: { Icon: UserPlus, tone: 'success' },
  changes_requested: { Icon: PenLine, tone: 'warning' },
} as const satisfies Record<NeedKind, { Icon: LucideIcon; tone: 'neutral' | 'success' | 'warning' }>

/** How many names a second line writes before it counts the rest. */
const NAMED = 2

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
      existing.items!.push(row.label)
      existing.owners = [...new Set([...existing.owners, ...row.owners])]
      continue
    }
    groups.set(key, {
      kind,
      verbKey: GROUPED_VERB[kind],
      href,
      count: row.count,
      owners: row.owners,
      label: null,
      items: [row.label],
      collection: list,
      collectionLabel: list ? `nav.${list}` : undefined,
    })
  }
  return [...groups.values()]
}

/** "A, B, and 3 more" in the reader's language, each name isolated for its own direction. */
function Names({ names, more }: { names: string[]; more: 'needs.moreItems' | 'needs.morePeople' }) {
  const t = useTranslations('Portal')
  const locale = useLocale()
  const named = names.slice(0, NAMED)
  const rest = names.length - named.length
  const list = rest > 0 ? [...named, t(more, { count: rest })] : named
  return new Intl.ListFormat(locale)
    .formatToParts(list)
    .map((part, index) =>
      part.type === 'element' ? <bdi key={index}>{part.value}</bdi> : part.value,
    )
}

/** The muted second line of a row: which item or course, and who it is from. */
function Details({ row }: { row: Shown }) {
  const t = useTranslations('Portal')
  const untitled = t(
    row.collection === 'courses'
      ? 'needs.untitledCourse'
      : row.collection === 'publications'
        ? 'needs.untitledPublication'
        : 'needs.untitledArticle',
  )
  const titles =
    row.kind === 'applicants'
      ? (row.courses ?? [])
      : row.items
        ? row.items.flatMap((item) => item ?? [])
        : [row.label ?? untitled]
  const parts = [
    row.collectionLabel && <span key="collection">{t(row.collectionLabel)}</span>,
    titles.length > 0 && (
      <span key="titles">
        <Names names={titles} more="needs.moreItems" />
      </span>
    ),
    row.owners.length > 0 && (
      <span key="owners">
        {t.rich('needs.ownersRich', {
          names: () => <Names names={row.owners} more="needs.morePeople" />,
        })}
      </span>
    ),
  ].filter(Boolean)
  return parts.length > 0 ? (
    <span className={styles.details}>
      {parts.flatMap((part, index) => (index ? [' ', part] : [part]))}
    </span>
  ) : null
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
  const headingId = useId()
  const locale = localeOf(useLocale())
  const shown: Shown[] = group ? grouped(rows, locale) : rows
  return (
    <section className={styles.section} aria-labelledby={headingId} data-needs>
      <h2 id={headingId} className={styles.heading}>
        {t('needs.heading')}
        {total !== null && total > 0 && (
          <span className={styles.total}>{localDigits(total, locale)}</span>
        )}
      </h2>
      {total === null && (
        <p className={styles.notice}>
          {t('needs.someFailed')}
          <Announce message={t('needs.someFailed')} />
        </p>
      )}
      {total === 0 && <p className={styles.empty}>{t('needs.empty')}</p>}
      {shown.length > 0 && (
        <ul className={styles.rows}>
          {shown.map((row) => {
            const { Icon, tone } = KIND_LOOK[row.kind]
            return (
              <li key={`${row.kind}:${row.href}`}>
                <a href={row.href} className={styles.need} data-need-kind={row.kind}>
                  <span className={styles.tile} data-tone={tone} aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                  <span className={styles.text}>
                    <span className={styles.verb}>
                      {t(row.verbKey as 'needs.review', { count: row.count })}
                    </span>{' '}
                    <Details row={row} />
                  </span>
                  <ChevronRight
                    size={18}
                    strokeWidth={1.75}
                    aria-hidden="true"
                    className={styles.go}
                  />
                </a>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
