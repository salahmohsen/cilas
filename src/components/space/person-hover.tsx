'use client'

import { AvatarImage } from '@/components/person/avatar-image'
import { personAvatarSeed } from '@/lib/avatar'
import type { ReactElement } from 'react'
import { Globe } from 'lucide-react'
import { siFacebook, siInstagram, siX, siYoutube } from 'simple-icons'

import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import type { PersonLink } from '@/lib/space-members'

import styles from './space.module.css'

/** One person as every space surface shows them: the same card wherever their name or face appears. */
export type PersonCard = {
  id: number
  name: string
  photo: string | null
  /** Already translated, such as "Fellow" or "Member". */
  role: string
  bio: string | null
  links: PersonLink[]
  /** The public profile, when the person is shown on the site. */
  href: string | null
}

// simple-icons dropped LinkedIn at the brand's request; this is its public mark.
const LINKEDIN =
  'M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z'

const BRAND: Record<Exclude<PersonLink['kind'], 'website'>, string> = {
  facebook: siFacebook.path,
  instagram: siInstagram.path,
  x: siX.path,
  youtube: siYoutube.path,
  linkedin: LINKEDIN,
}

const LABEL: Record<PersonLink['kind'], string> = {
  website: 'Website',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
}

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
            aria-label={LABEL[link.kind]}
            className={styles.personLink}
          >
            {link.kind === 'website' ? (
              <Globe size={16} aria-hidden="true" />
            ) : (
              <svg
                aria-hidden="true"
                fill="currentColor"
                width={15}
                height={15}
                viewBox="0 0 24 24"
              >
                <path d={BRAND[link.kind]} />
              </svg>
            )}
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
