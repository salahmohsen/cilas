'use client'

import { useTranslations } from 'next-intl'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import {
  FilterMenu,
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

/** Replaces the URL's filters and starts the list again at its first batch. */
function useFeedNavigate() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const [, startTransition] = useTransition()
  return (change: (next: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString())
    next.delete('shown')
    change(next)
    const search = next.toString()
    startTransition(() =>
      router.replace(search ? `${pathname}?${search}` : pathname, { scroll: false }),
    )
  }
}

/**
 * The Filter trigger beside the view switch: it opens a field, then a value,
 * and sets that filter in the URL. The page lists the matching posts.
 */
export function FeedFilterMenu({
  fields,
  filters,
}: {
  /** Only fields with more than one value to choose. */
  fields: FilterField[]
  /** The filters set now, so the menu marks their values. */
  filters: FilterChip[]
}) {
  const t = useTranslations('Spaces.filters')
  const navigate = useFeedNavigate()
  if (!fields.length) return null
  return (
    <FilterMenu
      active={filters}
      align="end"
      backLabel={t('back')}
      fields={fields}
      label={t('add')}
      onSelect={(chip, field) => {
        const value = field.options
          .map((o) => (typeof o === 'string' ? { value: o, label: o } : o))
          .find((o) => (o.label ?? o.value) === chip.value)?.value
        if (value) navigate((next) => next.set(field.id, value))
      }}
    />
  )
}

/**
 * The filters set now, a chip each, on a row of their own under the view
 * switch. With none set the row is not there: the Filter trigger adds one.
 */
export function SpaceFeedFilters({ filters }: { filters: FilterChip[] }) {
  const t = useTranslations('Spaces.filters')
  const navigate = useFeedNavigate()
  if (!filters.length) return null
  return (
    <FilterToolbar
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
