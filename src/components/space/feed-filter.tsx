'use client'

import { useRouter } from 'next/navigation'

import SegmentedControl from '@/components/arc/segmented-control/segmented-control'

/** All posts or announcements only: two views of one feed, kept in the URL. */
export function FeedFilter({
  path,
  value,
  label,
  options,
}: {
  path: string
  value: string
  label: string
  options: { value: string; label: string }[]
}) {
  const router = useRouter()
  return (
    <SegmentedControl
      label={label}
      value={value}
      options={options}
      onValueChange={(next) =>
        router.push(next === 'all' ? path : `${path}?tab=${next}`, { scroll: false })
      }
    />
  )
}
