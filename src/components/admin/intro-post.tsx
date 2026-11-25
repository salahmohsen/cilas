import { RenderDefaultCell } from '@payloadcms/ui'
import type {
  BeforeListTableServerProps,
  DefaultServerCellComponentProps,
  Payload,
  UIFieldServerComponent,
} from 'payload'
import Link from 'next/link'
import { cache } from 'react'

import { relId } from '@/lib/relation'

/**
 * The posts that are a space's intro post. The space's `introduction_post`
 * link is the only mark: a post has no kind of its own for it (see
 * addIntroPost, src/lib/space-hooks.ts). One read per render.
 */
const introPostIds = cache(async (payload: Payload): Promise<Set<number>> => {
  const { docs } = await payload.find({
    collection: 'spaces',
    where: { introduction_post: { exists: true } },
    depth: 0,
    pagination: false,
    overrideAccess: true,
    select: { introduction_post: true },
  })
  return new Set(
    docs.flatMap((s) => {
      const id = relId(s.introduction_post)
      return typeof id === 'number' ? [id] : []
    }),
  )
})

const LABEL = 'Introduction'
const LIST = '/admin/collections/space-posts'
const FILTER = 'where[id][in]'

/**
 * The Posts list's "Kind" column: an intro post shows as "Introduction".
 * Payload's own cell draws it, so the column keeps the row's link, and its
 * selection when the list opens in a relationship drawer.
 */
export async function IntroKindCell({
  cellData,
  collectionSlug,
  columnIndex,
  link,
  linkURL,
  payload,
  rowData,
  viewType,
}: DefaultServerCellComponentProps) {
  const intro = (await introPostIds(payload)).has(Number(rowData.id))
  return (
    <RenderDefaultCell
      clientProps={{
        cellData: intro ? LABEL : cellData,
        collectionSlug,
        field: { name: 'kind', type: 'text' } as never,
        link,
        linkURL,
        rowData,
        viewType,
      }}
      columnIndex={columnIndex ?? 0}
      isLinkedColumn={Boolean(link)}
    />
  )
}

/** Above the Posts list: show only the intro posts, or all posts again. */
export async function IntroPostsFilter({ payload, searchParams }: BeforeListTableServerProps) {
  const ids = [...(await introPostIds(payload))].sort((a, b) => a - b).join(',')
  if (!ids) return null
  // The slot gets the query string's keys as written, not parsed into `where`.
  const active = searchParams?.[FILTER] === ids
  return (
    <p style={{ margin: '0 0 16px' }}>
      {active ? (
        <>
          Showing the introduction posts only. <Link href={LIST}>Show all posts</Link>
        </>
      ) : (
        <Link href={`${LIST}?${FILTER}=${ids}`}>Show only introduction posts</Link>
      )}
    </p>
  )
}

/** At the top of an intro post's edit page: what the post does, and why it stays. */
export const IntroPostNote: UIFieldServerComponent = async ({ id, payload }) => {
  if (id == null || !(await introPostIds(payload)).has(Number(id))) return null
  return (
    <div
      className="cilas-admin-box"
      style={{ gridColumn: '1 / -1', padding: '12px 16px', margin: '0 0 8px' }}
    >
      <strong>This is the space’s introduction post.</strong> Members comment on it to get into the
      space. You can edit its text, but not delete it.
    </div>
  )
}
