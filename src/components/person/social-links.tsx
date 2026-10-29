import type { Person } from '@/payload-types'
import type { PersonLink } from '@/lib/space-members'
import { locationUrl } from '@/lib/space-event'
import { SocialIcon, SOCIAL_LABELS } from './social-icon'
import styles from './social-links.module.css'

export function SocialLinks({
  person,
  websiteLabel,
}: {
  person: Pick<Person, 'website' | 'social_links'>
  websiteLabel: string
}) {
  const links: PersonLink[] = [
    { kind: 'website', url: person.website ?? '' },
    ...(person.social_links ?? []).map(({ platform, url }) => ({ kind: platform, url })),
  ]
  const validLinks = links.flatMap((link) => {
    const url = locationUrl(link.url)
    return url ? [{ ...link, url }] : []
  })
  if (!validLinks.length) return null

  return (
    <ul className={styles.links}>
      {validLinks.map(({ kind, url }) => {
        const label = kind === 'website' ? websiteLabel : SOCIAL_LABELS[kind]
        return (
          <li key={`${kind}-${url}`}>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={label}
              title={label}
            >
              <SocialIcon kind={kind} />
            </a>
          </li>
        )
      })}
    </ul>
  )
}
