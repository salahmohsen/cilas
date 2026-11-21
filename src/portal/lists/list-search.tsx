'use client'

import { useState } from 'react'

import { SearchField } from '@/components/arc/search-field/search-field'

import type { Chip } from './groups'
import styles from './lists.module.css'

/**
 * The list search: a GET form to the list path, so it works with no
 * script. It keeps the chosen chip. A new search starts at page 1.
 */
export function ListSearch({
  q,
  show,
  action,
  label,
  clearLabel,
}: {
  q: string | null
  show: Chip | null
  action: string
  label: string
  clearLabel: string
}) {
  const [value, setValue] = useState(q ?? '')
  return (
    <form role="search" method="get" action={action} className={styles.search}>
      <SearchField
        name="q"
        label={label}
        labelHidden
        value={value}
        onValueChange={setValue}
        clearLabel={clearLabel}
        enterKeyHint="search"
      />
      {show && <input type="hidden" name="show" value={show} />}
    </form>
  )
}
