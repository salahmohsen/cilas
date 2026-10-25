import { shortAddress, titleKey } from '@/lib/link-title'

import styles from './space.module.css'

/**
 * A bare address shown as the page's title, or shortened when the title could
 * not be read. The full address stays in the `title` attribute and `href`.
 */
export const TitledLink = ({ url, titles }: { url: string; titles?: Record<string, string> }) => {
  const title = titles?.[titleKey(url)]
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={title ? url : undefined}
      className={styles.titledLink}
    >
      <bdi>{title ?? shortAddress(url)}</bdi>
    </a>
  )
}
