'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'

// Sample filters until the list is wired to real cycles and fellows.
const fieldsFor = (t: (key: string) => string): FilterField[] => [
  {
    id: 'cycle',
    label: t('cycle'),
    options: [
      { value: 'fall', label: t('fall') },
      { value: 'winter', label: t('winter') },
      { value: 'spring', label: t('spring') },
      { value: 'summer', label: t('summer') },
    ],
  },
  {
    id: 'cycle_year',
    label: t('cycleYear'),
    options: [
      { value: '2023', label: '2023' },
      { value: '2024', label: '2024' },
      { value: '2025', label: '2025' },
      { value: '2026', label: '2026' },
    ],
  },
  {
    id: 'year',
    label: t('academicYear'),
    options: [
      { value: '2024-2025', label: '2024–2025' },
      { value: '2025-2026', label: '2025–2026' },
      { value: '2026-2027', label: '2026–2027' },
    ],
  },
  {
    id: 'fellow',
    label: t('fellow'),
    options: [
      { value: 'karim-goessinger', label: 'Karim-Yassin Goessinger' },
      { value: 'surti-singh', label: 'Surti Singh' },
      { value: 'teun-dekker', label: 'Teun J. Dekker' },
      { value: 'ikai-jeng', label: 'I-Kai Jeng' },
      { value: 'robin-weiss', label: 'Robin Weiss' },
    ],
  },
  {
    id: 'type',
    label: t('courseType'),
    options: [
      { value: 'bridge', label: t('bridge') },
      { value: 'core', label: t('core') },
      { value: 'thematic', label: t('thematic') },
      { value: 'lab', label: t('lab') },
      { value: 'workshop', label: t('workshop') },
    ],
  },
]

export function StudyFilters() {
  const t = useTranslations('Study.filters')
  const [filters, setFilters] = useState<FilterChip[]>([])

  const handleAddFilter = (chip: FilterChip, field: FilterField) => {
    setFilters((prev) => [...prev.filter((f) => f.id !== chip.id), chip])
  }

  const handleRemoveFilter = (id: string) => {
    setFilters((prev) => prev.filter((f) => f.id !== id))
  }

  const handleClearAll = () => {
    setFilters([])
  }

  return (
    <div className="study-filters space-y-6">
      <FilterToolbar
        filters={filters}
        onRemove={handleRemoveFilter}
        onClearAll={handleClearAll}
        addFilter={{
          fields: fieldsFor(t),
          onAdd: handleAddFilter,
          label: t('add'),
        }}
        label={t('label')}
      />
    </div>
  )
}
