import Link from 'next/link'

import { EmptyState } from '@/components/arc/empty-state/empty-state'
import { LineChart } from '@/components/arc/line-chart/line-chart'
import { bucketByDay, countBy, thinAxis } from '@/lib/admin-stats'

import { cachedStat } from '../cached'
import styles from '../dashboard.module.css'
import { WidgetCard } from '../widget-card'

const DAY = 86_400_000

type Activity = 'space-posts' | 'space-comments' | 'space-reactions'

/** Creation times of the last 30 days; the filter keeps the scan small as the tables grow. */
const stamps = (collection: Activity) =>
  cachedStat<string[]>(`${collection}-30d`, async (payload) => {
    const { docs } = await payload.find({
      collection,
      where: { createdAt: { greater_than: new Date(Date.now() - 31 * DAY).toISOString() } },
      select: { createdAt: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    return docs.map((doc) => doc.createdAt)
  })

export async function CommunityActivity() {
  const [posts, comments, reactions] = await Promise.all([
    stamps('space-posts'),
    stamps('space-comments'),
    stamps('space-reactions'),
  ])
  const [p, c, r] = [posts, comments, reactions].map((s) => thinAxis(bucketByDay(s, 30), 5))
  return (
    <WidgetCard title="Community activity" description="Last 30 days">
      <LineChart
        data={p.map((point, i) => ({
          key: point.key,
          label: point.label,
          axisLabel: point.axisLabel,
          values: { posts: point.value, comments: c[i]?.value ?? 0, reactions: r[i]?.value ?? 0 },
        }))}
        series={[
          { key: 'posts', label: 'Posts', color: 'var(--series-1)' },
          { key: 'comments', label: 'Comments', color: 'var(--series-2)' },
          { key: 'reactions', label: 'Reactions', color: 'var(--series-3)' },
        ]}
        label="Community activity per day"
        categoryLabel="Day"
        emptyLabel="No community activity yet"
        height={200}
      />
    </WidgetCard>
  )
}

type ActiveSpace = { id: number; name: string; posts: number }

/** A course or cohort space has no name of its own; it takes its course or programme title. */
const activeSpaces = () =>
  cachedStat<ActiveSpace[]>('active-spaces', async (payload) => {
    const { docs: posts } = await payload.find({
      collection: 'space-posts',
      where: { createdAt: { greater_than: new Date(Date.now() - 30 * DAY).toISOString() } },
      select: { space: true },
      pagination: false,
      depth: 0,
      overrideAccess: true,
    })
    const counts = countBy(posts, (post) => String(post.space))
    const top = Object.entries(counts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
    if (top.length === 0) return []

    const { docs: spaces } = await payload.find({
      collection: 'spaces',
      where: { id: { in: top.map(([id]) => Number(id)) } },
      select: { name: true, kind: true, course: true, programme: true },
      populate: { courses: { title: true }, programmes: { title: true } },
      pagination: false,
      depth: 1,
      overrideAccess: true,
    })
    const nameOf = new Map(
      spaces.map((space) => [
        space.id,
        space.name ||
          (typeof space.course === 'object' && space.course?.title) ||
          (typeof space.programme === 'object' && space.programme?.title) ||
          'Community',
      ]),
    )
    return top.map(([id, posts]) => ({
      id: Number(id),
      name: nameOf.get(Number(id)) || 'Community',
      posts,
    }))
  })

export async function ActiveSpaces() {
  const spaces = await activeSpaces()
  return (
    <WidgetCard title="Active spaces" description="Most posts in the last 30 days">
      {spaces.length === 0 ? (
        <EmptyState
          title="No posts yet"
          description="Spaces with new posts in the last 30 days appear here."
        />
      ) : (
        <ul className={styles.list}>
          {spaces.map(({ id, name, posts }) => (
            <li key={id} className={styles.row}>
              <Link href={`/admin/collections/spaces/${id}`} className={styles.rowMain}>
                {name}
              </Link>
              <span className={styles.rowMeta}>{posts === 1 ? '1 post' : `${posts} posts`}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetCard>
  )
}
