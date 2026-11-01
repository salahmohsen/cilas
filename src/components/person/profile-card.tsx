import type { CSSProperties, ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'

import { AvatarImage } from '@/components/person/avatar-image'
import { SocialLinks } from '@/components/person/social-links'
import { personAvatarSeed } from '@/lib/avatar'
import { focalPointStyle } from '@/lib/media-image'
import { EVENT_POSTER_COLORS } from '@/lib/event-poster-colors'
import type { Person } from '@/payload-types'
import styles from './profile-card.module.css'

export const PROFILE_COLORS = [
  EVENT_POSTER_COLORS.panel,
  EVENT_POSTER_COLORS.book_discussion,
  EVENT_POSTER_COLORS.talk,
  EVENT_POSTER_COLORS.reading_group,
]

export function ProfileCard({
  person,
  children,
  color,
  role,
}: {
  person: Person
  children?: ReactNode
  /** The card's colour; by default one of PROFILE_COLORS, from the person. */
  color?: string
  /** What the person does here, e.g. "Moderator", under the name. */
  role?: string | null
}) {
  const t = useTranslations('Person')
  const locale = useLocale()
  const photo = typeof person.photo === 'object' ? person.photo : null
  return (
    <div className={`${styles.frame} not-prose`}>
      <article
        className={`poster ${styles.card} not-prose`}
        style={
          {
            '--poster-color': color ?? PROFILE_COLORS[person.id % PROFILE_COLORS.length],
          } as CSSProperties
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
          {role ? <span className={styles.role}>{role}</span> : null}
        </h3>
        <div className={styles.body}>{children}</div>
        <footer className={styles.links}>
          <SocialLinks person={person} websiteLabel={t('website')} />
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
    </div>
  )
}
