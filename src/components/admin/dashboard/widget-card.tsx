import { useId, type ReactNode } from 'react'

import styles from './dashboard.module.css'

/** The frame every widget shares: a titled region on an Arc surface. */
export function WidgetCard({
  title,
  description,
  action,
  children,
}: {
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}) {
  const id = useId()
  return (
    <section className={styles.card} aria-labelledby={id}>
      <header className={styles.cardHeader}>
        <div>
          <h2 id={id} className={styles.cardTitle}>
            {title}
          </h2>
          {description && <p className={styles.cardNote}>{description}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  )
}
