import { getFormatter, getNow } from 'next-intl/server'

import { Tooltip } from '@/components/arc/tooltip/tooltip'

const WEEK = 7 * 86_400_000

/** Relative time for a week, then the date; the exact time on hover or focus. */
export async function When({ iso, className }: { iso: string; className?: string }) {
  const [format, now] = await Promise.all([getFormatter(), getNow()])
  const date = new Date(iso)
  const recent = now.getTime() - date.getTime() < WEEK
  const exact = format.dateTime(date, { dateStyle: 'long', timeStyle: 'short' })
  return (
    <Tooltip content={exact}>
      <time dateTime={iso} className={className} tabIndex={0}>
        {recent ? format.relativeTime(date, now) : format.dateTime(date, { dateStyle: 'medium' })}
      </time>
    </Tooltip>
  )
}
