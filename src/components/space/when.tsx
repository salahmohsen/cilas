import { getFormatter, getNow } from 'next-intl/server'

import { Tooltip } from '@/components/arc/tooltip/tooltip'

import { PostDateLink } from './post-dialog-link'

const WEEK = 7 * 86_400_000

/** Relative time for a week, then the date; the exact time on hover or focus. */
export async function When({
  iso,
  className,
  post,
}: {
  iso: string
  className?: string
  /** The time becomes a link that opens this post in a dialog */
  post?: { id: number; href: string; photos: boolean }
}) {
  const [format, now] = await Promise.all([getFormatter(), getNow()])
  const date = new Date(iso)
  const recent = now.getTime() - date.getTime() < WEEK
  const exact = format.dateTime(date, { dateStyle: 'long', timeStyle: 'short' })
  const text = recent
    ? format.relativeTime(date, now)
    : format.dateTime(date, { dateStyle: 'medium' })
  if (post)
    return (
      <Tooltip content={exact}>
        <PostDateLink href={post.href} postId={post.id} photos={post.photos}>
          <time dateTime={iso} className={className}>
            {text}
          </time>
        </PostDateLink>
      </Tooltip>
    )
  return (
    <Tooltip content={exact}>
      <time dateTime={iso} className={className} tabIndex={0}>
        {text}
      </time>
    </Tooltip>
  )
}
