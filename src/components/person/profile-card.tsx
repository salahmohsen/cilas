import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { AvatarImage } from '@/components/person/avatar-image'
import { personAvatarSeed } from '@/lib/avatar'
import { focalPointStyle } from '@/lib/media-image'
import { locationUrl } from '@/lib/space-event'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import type { Person } from '@/payload-types'
import styles from './profile-card.module.css'

const SOCIAL_NAMES = {
  facebook: 'Facebook',
  x: 'X',
  youtube: 'YouTube',
  instagram: 'Instagram',
  linkedin: 'LinkedIn',
}
const PROFILE_COLORS = [
  EVENT_POSTER_COLORS.panel,
  EVENT_POSTER_COLORS.book_discussion,
  EVENT_POSTER_COLORS.talk,
  EVENT_POSTER_COLORS.reading_group,
]

export function ProfileCard({ person, children }: { person: Person; children?: ReactNode }) {
  const t = useTranslations('Person')
  const locale = useLocale()
  const photo = typeof person.photo === 'object' ? person.photo : null
  const website = locationUrl(person.website)
  const links = (person.social_links ?? []).flatMap((link) => {
    const href = locationUrl(link.url)
    return href ? [{ href, label: SOCIAL_NAMES[link.platform] }] : []
  })
  return (
    <article
      className={`poster ${styles.card} not-prose`}
      style={
        { '--poster-color': PROFILE_COLORS[person.id % PROFILE_COLORS.length] } as CSSProperties
      }
    >
      <div className={styles.photo}>
        <AvatarImage
          src={photo?.url}
          alt={photo?.alt || person.name}
          fallbackSeed={personAvatarSeed(person.id)}
          style={focalPointStyle(photo)}
        />
      </div>
      <h3 className={styles.name} dir="auto">
        <a className="poster-link" href={`/${locale}/people/${person.slug}`}>
          {person.name}
        </a>
      </h3>
      <div className={styles.body}>{children}</div>
      <footer className={styles.links}>
        {website && (
          <a href={website} target="_blank" rel="noopener noreferrer">
            {t('website')}
          </a>
        )}
        {links.map(({ href, label }) => (
          <a href={href} key={`${label}-${href}`} target="_blank" rel="noopener noreferrer">
            {label}
          </a>
        ))}
        <a
          href={`/${locale}/people/${person.slug}`}
          className={`${styles.action} poster-action-cell`}
        >
          <span className="poster-action">
            {t('viewProfile')}
            <ArrowRight size={16} strokeWidth={2} aria-hidden className="poster-arrow" />
          </span>
        </a>
      </footer>
    </article>
  )
}
