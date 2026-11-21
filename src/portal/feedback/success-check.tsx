import styles from './success-check.module.css'

/**
 * A check that draws once beside `label`. It announces nothing: the caller
 * says what succeeded. Under reduced motion only the label shows.
 */
export function SuccessCheck({ label }: { label: string }): React.JSX.Element {
  return (
    <span className={styles.root}>
      <svg className={styles.check} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
        <path className={styles.path} d="M3.5 8.5l3 3 6-7" pathLength={1} />
      </svg>
      <span>{label}</span>
    </span>
  )
}
