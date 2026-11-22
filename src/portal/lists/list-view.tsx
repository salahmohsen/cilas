import buttonStyles from '@/components/arc/button/button.module.css'

import { groupSectionProps } from './group-section'
import type { Chip } from './groups'
import { ListRowBody, type RowIntl } from './list-row'
import styles from './lists.module.css'
import type { ListGroup, ListResult } from './rows'

/** The class of a secondary button link, for every portal list link that looks like one. */
export const secondaryButton = `${buttonStyles.button} ${buttonStyles.secondary} ${buttonStyles.md}`

function Notice({ text, link }: { text: React.ReactNode; link: { label: string; href: string } }) {
  return (
    <div className={styles.notice}>
      <p>{text}</p>
      <a href={link.href} className={secondaryButton}>
        {link.label}
      </a>
    </div>
  )
}

/**
 * The body of a list: the error line with Retry, the empty slot, the no
 * result and empty filter lines, or one section per group with its rows
 * and its `moreOf` slot. The empty state reads only `total` (the reader's
 * rows with no search and no filter), so a filter never hides its way back.
 */
export function ListViewBody({
  result,
  viewer,
  query,
  hrefs,
  empty,
  moreOf,
  ...intl
}: {
  result: ListResult | 'failed'
  viewer: 'owner' | 'admin'
  query: { q: string | null; show: Chip | null }
  hrefs: { retry: string; clearSearch: string; showAll: string }
  empty: React.ReactNode
  moreOf: (group: ListGroup) => React.ReactNode
} & RowIntl): React.JSX.Element {
  const { t } = intl
  if (result === 'failed')
    return (
      <Notice text={t('lists.loadError')} link={{ label: t('lists.retry'), href: hrefs.retry }} />
    )
  if (result.total === 0) return <>{empty}</>
  if (result.groups.length === 0) {
    if (query.q !== null)
      return (
        <Notice
          text={t.rich('lists.noResults', {
            query: query.q,
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
          link={{ label: t('lists.clearSearch'), href: hrefs.clearSearch }}
        />
      )
    if (query.show !== null)
      return (
        <Notice
          text={t('lists.noneInFilter')}
          link={{ label: t('lists.showAll'), href: hrefs.showAll }}
        />
      )
    return <>{empty}</>
  }
  return (
    <div className={styles.groups}>
      {result.groups.map((group) => {
        const headingId = `list-group-${group.id}`
        return (
          <section key={group.id} aria-labelledby={headingId} {...groupSectionProps(group.id)}>
            <h2 id={headingId} className={styles.groupHeading}>
              {t('lists.groupCount', { name: t(`lists.group.${group.id}`), count: group.total })}
            </h2>
            <ol className={styles.rows}>
              {group.rows.map((row) => (
                <ListRowBody key={row.id} row={row} viewer={viewer} {...intl} />
              ))}
            </ol>
            {moreOf(group)}
          </section>
        )
      })}
    </div>
  )
}

/** The list page's one catch: a load that throws is logged once and shows the error line. */
export const resultOrFailed = async (
  load: () => Promise<ListResult>,
  log: (error: unknown) => void,
): Promise<ListResult | 'failed'> => {
  try {
    return await load()
  } catch (error) {
    log(error)
    return 'failed'
  }
}
