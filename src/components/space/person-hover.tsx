'use client'

import { AvatarImage } from '@/components/arc/lib/avatar-image'
import { personAvatarSeed } from '@/lib/avatar'
import type { ReactElement } from 'react'
import { SocialIcon, SOCIAL_LABELS } from '@/components/person/social-icon'

import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import type { PersonCard, PersonLink } from '@/lib/space-members'

import styles from './space.module.css'

/** The person's website and social profiles as one row of icons. */
export function PersonLinks({ links }: { links: PersonLink[] }) {
  if (links.length === 0) return null
  return (
    <ul className={styles.personLinks}>
      {links.map((link) => (
        <li key={`${link.kind}-${link.url}`}>
          <a
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={SOCIAL_LABELS[link.kind]}
            className={styles.personLink}
          >
            <SocialIcon kind={link.kind} size={link.kind === 'website' ? 16 : 15} />
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * Wraps a name or a face in the person's card. The trigger must take a ref
 * and be focusable, so a keyboard reader gets the same card on focus.
 */
export function PersonHover({
  person,
  children,
  side,
}: {
  person: PersonCard
  children: ReactElement
  side?: 'top' | 'bottom'
}) {
  return (
    <HoverCard
      side={side}
      content={
        <HoverCardProfile
          name={person.name}
          role={person.role}
          avatar={
            <AvatarImage
              src={person.photo}
              fallbackSeed={personAvatarSeed(person.id)}
              width={48}
              height={48}
            />
          }
          bio={person.bio ?? undefined}
          meta={person.links.length > 0 ? <PersonLinks links={person.links} /> : undefined}
        />
      }
    >
      {children}
    </HoverCard>
  )
}
