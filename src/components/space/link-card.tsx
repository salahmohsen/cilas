import { getTranslations } from 'next-intl/server'

import { linkPreview, type LinkPreview } from '@/lib/link-preview'

import { LinkImage } from './link-image'
import styles from './space.module.css'

export async function LinkCard({ url }: { url: string }) {
  const preview = await linkPreview(url)
  if (!preview) return null
  return (
    <a href={preview.url} target="_blank" rel="noopener noreferrer" className={styles.linkCard}>
      {preview.image && <LinkImage src={preview.image} className={styles.linkImage} />}
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

const initial = (preview: LinkPreview) => (preview.site ?? preview.host).charAt(0).toUpperCase()

async function LinkList({ urls }: { urls: string[] }) {
  const t = await getTranslations('SpacePost')
  const previews = (await Promise.all(urls.map((url) => linkPreview(url)))).filter(
    (p): p is LinkPreview => p !== null,
  )
  if (!previews.length) return null
  return (
    <ul className={styles.linkList} aria-label={t('links')}>
      {previews.map((preview) => {
        const letter = (
          <span className={styles.linkInitial} aria-hidden="true">
            {initial(preview)}
          </span>
        )
        return (
          <li key={preview.url}>
            <a
              href={preview.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.linkRow}
            >
              {preview.image ? (
                <LinkImage src={preview.image} className={styles.linkThumb} fallback={letter} />
              ) : (
                letter
              )}
              <span className={styles.linkRowText}>
                <span dir="auto" className={styles.linkRowTitle}>
                  {preview.title}
                </span>
                <span className={styles.linkHost}>{preview.site ?? preview.host}</span>
              </span>
            </a>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The previews of a post's outside links: a card for one, a compact list for
 * several. `compact` keeps one link to the list's one-line row, for a card
 * that already has more to show, such as an event.
 */
export function LinkPreviews({ urls, compact = false }: { urls: string[]; compact?: boolean }) {
  if (urls.length === 0) return null
  return urls.length === 1 && !compact ? <LinkCard url={urls[0]!} /> : <LinkList urls={urls} />
}
