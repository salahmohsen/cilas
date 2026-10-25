import { getFormatter, getNow } from 'next-intl/server'

import { Tooltip } from '@/components/arc/tooltip/tooltip'

import { PostDateLink } from './post-dialog-link'

const WEEK = 7 * 86_400_000

/** Relative time for a week, then the date; the exact time on hover or focus. */
export async function When({
  iso,
  className,
  postHref,
}: {
  iso: string
  className?: string
  /** The time becomes a link to this post's page, which opens its dialog */
  postHref?: string
}) {
  const [format, now] = await Promise.all([getFormatter(), getNow()])
  const date = new Date(iso)
  const recent = now.getTime() - date.getTime() < WEEK
  const exact = format.dateTime(date, { dateStyle: 'long', timeStyle: 'short' })
  const text = recent
    ? format.relativeTime(date, now)
    : format.dateTime(date, { dateStyle: 'medium' })
  if (postHref)
    return (
      <Tooltip content={exact}>
        <PostDateLink href={postHref}>
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
