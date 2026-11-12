import { Skeleton } from '../../skeleton/skeleton'
import styles from './blog-grid.module.css'

/**
 * Holds a blog grid's place while its cards load: the grid's own columns, card
 * frames and gaps (blog-grid.module.css), each card an image frame over a few
 * lines. Only its look is shared, so a page can show it before the grid's code
 * has loaded. Only seen: the page announces the wait.
 */
export function BlogGridSkeleton({ count, flush = false }: { count: number; flush?: boolean }) {
  return (
    <div aria-hidden className={styles.root} data-flush={flush || undefined}>
      <div className={styles.inner}>
        <div className={styles.grid}>
          {Array.from({ length: count }, (_, i) => (
            <div className={styles.card} key={i}>
              <div className={styles.imageFrame} data-skeleton="" />
              <div className={styles.cardBody}>
                <Skeleton lines={3} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
