import type { ReactNode } from 'react'

/** A row of toggles with exactly one pressed. */
export function ToggleStrip(_props: {
  labelledBy: string
  value: string
  onValueChange: (value: string) => void
  items: readonly { value: string; current?: 'date'; content: ReactNode }[]
  className?: string
}): React.JSX.Element {
  return <div />
}
