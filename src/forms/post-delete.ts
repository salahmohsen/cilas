import type { PayloadRequest } from 'payload'

import { isAdminUser } from '@/access'
import { nonEmpty } from '@/lib/delete-summary'
import { countPostContent, spaceContentGroups } from '@/lib/space-delete'

import { deleteEndpoints } from './delete-endpoints'

/** How long the dialog's title may quote a post's first line. */
const QUOTED = 60

/** The event's name, or the body's first line; a deleted post's placeholder has neither. */
const postName = (post: { body?: string | null; event_title?: string | null }, id: number) => {
  const first = post.event_title?.trim() || post.body?.trim().split('\n')[0] || ''
  // The body is Markdown: its marks would show as typed in the dialog's title.
  const line = first.replace(/[*_`#>]/g, '').trim()
  if (!line) return `Post ${id}`
  return line.length > QUOTED ? `${line.slice(0, QUOTED - 1).trimEnd()}…` : line
}

/**
 * A space's intro post opens the space to its members (introGated,
 * src/lib/space-rules.ts): without it the gate is gone, and the members'
 * introductions would be deleted with it. postRemove refuses it for the same
 * reason. The space's own delete still takes it.
 */
const introOf = async (req: PayloadRequest, id: number) =>
  (
    await req.payload.count({
      collection: 'spaces',
      where: { introduction_post: { equals: id } },
      overrideAccess: true,
      req,
    })
  ).totalDocs > 0

/**
 * The only way to delete a post from the admin panel: the collection's own
 * delete access is closed so the dialog shows the comments and the rest that
 * go with the post first. The collection's beforeDelete removes them in the
 * same transaction.
 */
export const postDeleteEndpoints = deleteEndpoints('space-posts', {
  summarize: async (req, id) => {
    const post = await req.payload.findByID({
      collection: 'space-posts',
      id,
      depth: 0,
      overrideAccess: true,
      req,
      select: { body: true, event_title: true },
    })
    const { comments, files, reactions, votes, rsvps } = await countPostContent(req, id)
    return {
      name: postName(post, id),
      noun: 'post',
      typeToConfirm: false,
      deletes: nonEmpty(spaceContentGroups({ posts: 0, comments, files, reactions, votes, rsvps })),
      unlinks: [],
    }
  },
  blocked: async (req, id) => {
    if (!isAdminUser(req.user)) return 'Admins only.'
    if (await introOf(req, id))
      return 'This is the space’s introduction post. Members answer it to get into the space, so it cannot be deleted. Edit its text instead.'
    return null
  },
})
