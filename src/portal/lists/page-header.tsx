import type { ReactNode } from 'react'

import buttonStyles from '@/components/arc/button/button.module.css'

import styles from './lists.module.css'

/**
 * A portal page header: the H1, an optional subtitle and at most one
 * primary button. Every 1b primary is an admin page, so it is a plain
 * link (a full load, no locale prefix).
 */
export function PortalPageHeader({
  title,
  subtitle,
  primary,
  children,
}: {
  title: string
  subtitle?: string
  primary?: { label: string; href: string }
  children?: ReactNode
}): React.JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.heading}>
        <h1 className={styles.h1}>{title}</h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {primary && (
        <a
          href={primary.href}
          className={`${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.md} ${styles.primary}`}
        >
          {primary.label}
        </a>
      )}
      {children}
    </header>
  )
}
