'use client'

import { useState } from 'react'
import {
  FilterToolbar,
  type FilterChip,
  type FilterField,
} from '@/components/arc/filter-toolbar/filter-toolbar'

const mockFields: FilterField[] = [
  {
    id: 'cycle',
    label: 'Cycle',
    options: [
      { value: 'fall', label: 'Fall' },
      { value: 'winter', label: 'Winter' },
      { value: 'spring', label: 'Spring' },
      { value: 'summer', label: 'Summer' },
    ],
  },
  {
    id: 'cycle_year',
    label: 'Cycle Year',
    options: [
      { value: '2023', label: '2023' },
      { value: '2024', label: '2024' },
      { value: '2025', label: '2025' },
      { value: '2026', label: '2026' },
    ],
  },
  {
    id: 'year',
    label: 'Academic Year',
    options: [
      { value: '2024-2025', label: '2024–2025' },
      { value: '2025-2026', label: '2025–2026' },
      { value: '2026-2027', label: '2026–2027' },
    ],
  },
  {
    id: 'fellow',
    label: 'Fellow',
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
    label: 'Course Type',
    options: [
      { value: 'bridge', label: 'Bridge Programme' },
      { value: 'core', label: 'Core Curriculum' },
      { value: 'thematic', label: 'Thematic Courses' },
      { value: 'lab', label: 'Labs' },
      { value: 'workshop', label: 'Workshops' },
    ],
  },
]

export function StudyFilters() {
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
          fields: mockFields,
          onAdd: handleAddFilter,
          label: 'Add filter',
        }}
        label="Course filters"
      />
    </div>
  )
}
