import type { CSSProperties, ReactNode } from 'react'

import { POSTER_COLORS } from '@/lib/poster-colors'

/**
 * A page's side column as one poster card: sections under ink rules, each
 * named on a band of the card's colour (styles in `.side-card*`).
 */
export function SideCard({
  as: Tag = 'div',
  color = POSTER_COLORS[0],
  label,
  className,
  children,
}: {
  as?: 'div' | 'aside'
  color?: string
  label?: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tag
      aria-label={label}
      className={`side-card${className ? ` ${className}` : ''}`}
      style={{ '--poster-color': color } as CSSProperties}
    >
      {children}
    </Tag>
  )
}

/**
 * One section: its band, then its content. `fold` makes the band a summary
 * that opens and closes the section (closed at first).
 */
export function SideCardSection({
  label,
  fold = false,
  children,
}: {
  label: string
  fold?: boolean
  children: ReactNode
}) {
  if (fold)
    return (
      <details className="side-card-section">
        <summary className="side-card-label">{label}</summary>
        {children}
      </details>
    )
  return (
    <section aria-label={label} className="side-card-section">
      <h2 className="side-card-label">{label}</h2>
      {children}
    </section>
  )
}
