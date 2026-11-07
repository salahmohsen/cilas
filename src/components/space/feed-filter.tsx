'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'
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

/** The feed's filters a reader may set: each is one URL parameter. */
export const FEED_FILTERS = ['session', 'kind', 'author'] as const
export type FeedFilterId = (typeof FEED_FILTERS)[number]

/**
 * Narrowing the feed by session, post type or author. The page reads the
 * filters from the URL and lists the matching posts; each change replaces
 * the URL and starts the list again at its first batch.
 */
export function SpaceFeedFilters({
  fields,
  filters,
}: {
  /** Only fields with more than one value to choose. */
  fields: FilterField[]
  /** The filters set now, a chip each, its id the URL parameter. */
  filters: FilterChip[]
}) {
  const t = useTranslations('Spaces.filters')
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()

  const navigate = (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString())
    next.delete('shown')
    change(next)
    const search = next.toString()
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }),
    )
  }

  if (!fields.length && !filters.length) return null
  return (
    <FilterToolbar
      addFilter={
        fields.length
          ? {
              fields,
              label: t('add'),
              align: 'end',
              onAdd: (chip, field) => {
                const value = field.options
                  .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
                  .find((o) => (o.label ?? o.value) === chip.value)?.value
                if (value) navigate((next) => next.set(field.id, value))
              },
            }
          : undefined
      }
      filters={filters}
      label={t('label')}
      text={{
        empty: t('none'),
        clearAll: t('clearAll'),
        back: t('back'),
        remove: (chip) => t('remove', { chip }),
        added: (chip) => t('added', { chip }),
        removed: (chip) => t('removed', { chip }),
        changed: (field, value) => t('changed', { field, value }),
        cleared: t('cleared'),
      }}
      onClearAll={() => navigate((next) => FEED_FILTERS.forEach((f) => next.delete(f)))}
      onRemove={(id) => navigate((next) => next.delete(id))}
    />
  )
}
