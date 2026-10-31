import type { ReactNode } from 'react'

import styles from './settings-parts.module.css'

/** The heading of one settings section. */
export function PanelHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <div className={styles.panelHeader}>
      <h2 className={styles.panelTitle}>{title}</h2>
      {intro ? <p className={styles.muted}>{intro}</p> : null}
    </div>
  )
}

/** Rows that belong together, under one heading. */
export function SettingsGroup({
  title,
  hint,
  lead,
  children,
}: {
  title: string
  hint?: string
  /** A control above the rows, such as the device switch. */
  lead?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={styles.group}>
      <div className={styles.groupHead}>
        <h3 className={styles.groupTitle}>{title}</h3>
        {hint ? <p className={styles.muted}>{hint}</p> : null}
      </div>
      {lead}
      <ul className={styles.rows}>{children}</ul>
    </section>
  )
}

/** A labelled row: words on one side, a control on the other. */
export function SettingsRow({
  id,
  label,
  hint,
  children,
}: {
  id: string
  label: string
  hint?: string
  children: ReactNode
}) {
  return (
    <li className={styles.row}>
      <div className={styles.rowText}>
        <p id={`${id}-label`} className={styles.rowLabel}>
          {label}
        </p>
        {hint ? (
          <p id={`${id}-hint`} className={styles.muted}>
            {hint}
          </p>
        ) : null}
      </div>
      <div className={styles.rowControl}>{children}</div>
    </li>
  )
}
