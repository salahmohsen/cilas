import { ArrowRight } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'

import { POSTER_COLORS } from '@/components/arc/lib/poster-colors'

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
  labelAction,
  fold = false,
  children,
}: {
  label: string
  labelAction?: ReactNode
  fold?: boolean
  children: ReactNode
}) {
  if (fold)
    return (
      <details className="side-card-section">
        <summary className="side-card-label">
          {label}
          {labelAction}
        </summary>
        {children}
      </details>
    )
  return (
    <section aria-label={label} className="side-card-section">
      <h2 className="side-card-label">
        {label}
        {labelAction}
      </h2>
      {children}
    </section>
  )
}

/**
 * Registration as its own card: the status with its dot, the price in a row
 * of its own, then Apply across the card in its colour. `primary` marks the
 * page's own Apply, which the sticky copy watches.
 */
export function SideCardApply({
  open,
  status,
  price,
  applyLabel,
  applyUrl,
  primary = false,
  newTab = false,
  color = POSTER_COLORS[0],
}: {
  open: boolean
  status: string
  price?: string | null
  applyLabel: string
  applyUrl?: string | null
  primary?: boolean
  newTab?: boolean
  color?: string
}) {
  return (
    <div className="side-card" style={{ '--poster-color': color } as CSSProperties}>
      <div className="apply-card-row">
        <span aria-hidden className="apply-card-dot" data-open={open || undefined} />
        <span className="apply-card-status">{status}</span>
      </div>
      {price ? <div className="apply-card-price">{price}</div> : null}
      {applyUrl ? (
        <a
          className="side-card-action"
          data-apply-primary={primary || undefined}
          href={applyUrl}
          {...(newTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
        >
          {applyLabel}
          <ArrowRight aria-hidden className="rtl:-scale-x-100" size={16} />
        </a>
      ) : null}
    </div>
  )
}
