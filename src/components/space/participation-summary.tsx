import { getFormatter, getTranslations } from 'next-intl/server'

import { SortableDataTable } from '@/components/arc/sortable-data-table/sortable-data-table'
import type { ParticipationRow } from '@/lib/spaces-data'

import styles from './space.module.css'

/** Moderators only (spec §13): members never see each other's numbers. */
export async function ParticipationSummary({ rows }: { rows: ParticipationRow[] }) {
  const [t, format] = await Promise.all([getTranslations('Participation'), getFormatter()])
  const table = rows.map((r) => ({
    id: String(r.personId),
    name: r.name,
    posts: r.posts,
    comments: r.comments,
    reactions: r.reactions,
    lastVisit: r.lastVisit ? format.relativeTime(new Date(r.lastVisit)) : t('never'),
  }))
  return (
    <section className={styles.column}>
      <SortableDataTable
        rows={table}
        rowKey="id"
        columns={[
          { key: 'name', label: t('member'), sortable: true },
          { key: 'posts', label: t('posts'), sortable: true, numeric: true },
          { key: 'comments', label: t('comments'), sortable: true, numeric: true },
          { key: 'reactions', label: t('reactions'), sortable: true, numeric: true },
          { key: 'lastVisit', label: t('lastVisit') },
        ]}
        defaultSort={{ key: 'posts', direction: 'desc' }}
      />
    </section>
  )
}
