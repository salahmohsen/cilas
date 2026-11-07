import { detailPath } from '@/lib/paths'
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
  look,
}: {
  /** 'fellow': the name on the colour panel and the bio on paper, as the course page's fellow cards. */
  look?: 'fellow'
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
        data-look={look}
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
          {/* The whole name box is the link; its arrow shows on hover and keyboard focus. */}
          <a
            className={`poster-link ${styles.nameLink}`}
            href={detailPath('people', String(person.slug), locale)}
          >
            <span className={styles.nameText}>
              {person.name}
              {role ? <span className={styles.role}>{role}</span> : null}
            </span>
            <ArrowRight size={20} strokeWidth={1.75} aria-hidden className={styles.arrow} />
          </a>
        </h3>
        <div className={styles.body}>{children}</div>
        <footer className={styles.links}>
          <SocialLinks person={person} websiteLabel={t('website')} />
        </footer>
      </article>
    </div>
  )
}
