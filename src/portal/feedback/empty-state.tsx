import buttonStyles from '@/components/arc/button/button.module.css'
import { Link } from '@/i18n/navigation'

import styles from './empty-state.module.css'

/**
 * What a portal view shows when it has nothing yet: a heading, one
 * sentence, an optional link to act on, and what happens next.
 */
export function PortalEmptyState({
  title,
  body,
  next,
  action,
}: {
  title: string
  body: string
  next?: string
  /** `external`: a path outside the locale routes (such as `/admin`), linked as it is. */
  action?: { label: string; href: string; external?: boolean }
}): React.JSX.Element {
  const actionClass = `${buttonStyles.button} ${buttonStyles.primary} ${buttonStyles.md} ${styles.action}`
  return (
    <div className={styles.card}>
      <h2 className={styles.title}>{title}</h2>
      <p className={styles.body}>{body}</p>
      {action &&
        (action.external ? (
          <a href={action.href} className={actionClass}>
            {action.label}
          </a>
        ) : (
          <Link href={action.href} className={actionClass}>
            {action.label}
          </Link>
        ))}
      {next && <p className={styles.next}>{next}</p>}
    </div>
  )
}
