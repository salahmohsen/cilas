'use client'

import {
  FilterToolbar,
  type FilterField,
  type FilterChip,
} from '@/components/arc/filter-toolbar/filter-toolbar'
import { applicantsCopy } from './applicants-copy'

export const applicantFilterKeys = ['course', 'status', 'cycle', 'reduction'] as const

export function ApplicantsFilter({
  fields,
  values,
  onChange,
  ar,
}: {
  fields: FilterField[]
  values: URLSearchParams
  onChange: (id?: string, value?: string) => void
  ar: boolean
}) {
  const t = applicantsCopy(ar)
  const filters: FilterChip[] = fields.flatMap((field) => {
    const value = values.get(field.id)
    if (!value) return []
    const option = field.options.find((o) => typeof o !== 'string' && o.value === value)
    return [
      {
        id: field.id,
        label: field.label,
        value: typeof option === 'object' ? (option.label ?? value) : value,
      },
    ]
  })
  // The Arc chip carries display text; menu option values carry URL identifiers.
  return (
    <FilterToolbar
      filters={filters}
      label={t.title}
      onRemove={(id) => onChange(id)}
      onClearAll={() => onChange()}
      text={{
        empty: t.noFilters,
        clearAll: t.clear,
        back: t.back,
        ...(ar
          ? {
              remove: (chip) => `إزالة ${chip}`,
              added: (chip) => `أضيف ${chip}`,
              removed: (chip) => `أزيل ${chip}`,
              changed: (field, value) => `${field}: ${value}`,
              cleared: 'مُسحت التصفيات',
            }
          : {}),
      }}
      addFilter={{
        fields,
        label: t.add,
        onAdd: (chip, field) => {
          const option = field.options.find(
            (o) => typeof o === 'object' && (o.label ?? o.value) === chip.value,
          )
          onChange(field.id, typeof option === 'object' ? option.value : chip.value)
        },
      }}
    />
  )
}
