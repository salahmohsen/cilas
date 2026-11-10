import { Info } from 'lucide-react'
import { useId, type ReactNode } from 'react'

import { HoverCard } from '@/components/arc/hover-card/hover-card'

import styles from './dashboard.module.css'

/**
 * The frame every widget shares: a titled region on an Arc surface. `info`
 * is a longer explanation, kept behind an icon that opens it in a hover card.
 */
export function WidgetCard({
  title,
  description,
  info,
  action,
  children,
}: {
  title: string
  description?: string
  info?: string
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <header className={styles.cardHeader}>
        <div>
          <div className={styles.cardTitleRow}>
            <h2 id={id} className={styles.cardTitle}>
              {title}
            </h2>
            {info && (
              // The card renders in a portal outside the dashboard, so it carries the Arc tokens itself.
              <HoverCard
                align="start"
                className="arc-scope"
                content={<p className={styles.cardInfo}>{info}</p>}
              >
                <button type="button" className={styles.infoTrigger} aria-label={`About ${title}`}>
                  <Info size={14} aria-hidden="true" />
                </button>
              </HoverCard>
            )}
          </div>
          {description && <p className={styles.cardNote}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
