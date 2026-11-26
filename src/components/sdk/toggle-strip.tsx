'use client'

import { Toggle, ToggleGroup } from '@ui-sdk/react/toggle'
import type { ReactNode } from 'react'

import styles from './toggle-strip.module.css'

/** A row of toggles with exactly one pressed. */
export function ToggleStrip({
  labelledBy,
  value,
  onValueChange,
  items,
  className,
}: {
  labelledBy: string
  value: string
  onValueChange: (value: string) => void
  items: readonly { value: string; current?: 'date'; content: ReactNode }[]
  className?: string
}): React.JSX.Element {
  return (
    <ToggleGroup
      aria-labelledby={labelledBy}
      className={className ? `${styles.strip} ${className}` : styles.strip}
      deselectable={false}
      value={[value]}
      onValueChange={([next]) => {
        if (next !== undefined) onValueChange(next)
      }}
    >
      {items.map((item) => (
        <Toggle
          key={item.value}
          value={item.value}
          aria-current={item.current}
          className={styles.toggle}
        >
          {item.content}
        </Toggle>
      ))}
    </ToggleGroup>
  )
}
