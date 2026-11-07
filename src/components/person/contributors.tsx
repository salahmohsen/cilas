import { detailPath } from '@/lib/paths'
import { personAvatarSeed } from '@/lib/avatar'
import { Avatar } from '@/components/arc/avatar/avatar'
import { Link } from '@/i18n/navigation'
import type { Media, Person } from '@/payload-types'

export type Contributor = { person: Person; role: string }

export const photoOf = (p: Person): string | undefined =>
  typeof p.photo === 'object' && p.photo ? ((p.photo as Media).url ?? undefined) : undefined

export function PersonLink({ person, className }: { person: Person; className?: string }) {
  return (
    <Link
      className={className ?? 'underline-offset-4 hover:underline'}
      href={detailPath('people', String(person.slug))}
    >
      {person.name}
    </Link>
  )
}

/** The same people as ruled rows, for a side card's section. */
export function ContributorRows({ contributors }: { contributors: Contributor[] }) {
  return (
    <ul className="side-card-people">
      {contributors.map(({ person, role }) => (
        <li key={`${person.id}-${role}`}>
          <Link href={detailPath('people', String(person.slug))}>
            <Avatar
              fallbackSeed={personAvatarSeed(person.id)}
              name={person.name}
              size="md"
              src={photoOf(person)}
            />
            <span className="min-w-0">
              <span className="side-card-name">{person.name}</span>
              <span className="side-card-role">{role}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
