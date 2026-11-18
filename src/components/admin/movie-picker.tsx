'use client'

import { useField, useLocale } from '@payloadcms/ui'
import type { JSONFieldClientProps } from 'payload'

import type { MovieSnapshot } from '@/lib/movie'

import { MoviePickerForm } from './movie-picker-form'

export function MoviePicker({ path, readOnly }: JSONFieldClientProps) {
  const { value, setValue, errorMessage, showError } = useField<MovieSnapshot | null>({ path })
  const locale = useLocale()
  return (
    <MoviePickerForm
      value={value}
      setValue={setValue}
      errorMessage={errorMessage}
      showError={showError}
      locale={String(locale?.code ?? 'en')}
      readOnly={readOnly}
    />
  )
}
