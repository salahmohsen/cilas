import { linkPreview } from '@/lib/link-preview'

import styles from './space.module.css'

/** A post's first outside link as a card: the page's image, title, summary and site. */
export async function LinkCard({ url }: { url: string }) {
  const preview = await linkPreview(url)
  if (!preview) return null
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer" className={styles.linkCard}>
      {preview.image && (
        // The image lives on another site; next/image would need every host allowed in advance.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className={styles.linkImage}
        />
      )}
      <span className={styles.linkText}>
        <span className={styles.linkHost}>{preview.site ?? preview.host}</span>
        <span dir="auto" className={styles.linkTitle}>
          {preview.title}
        </span>
        {preview.description && (
          <span dir="auto" className={styles.linkDescription}>
            {preview.description}
          </span>
        )}
      </span>
    </a>
  )
}
