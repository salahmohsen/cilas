import { Avatar } from '@/components/arc/avatar/avatar'
import { Link } from '@/i18n/navigation'
import type { Media, Person } from '@/payload-types'

export type Contributor = { person: Person; role: string }

export const photoOf = (p: Person): string | undefined =>
  typeof p.photo === 'object' && p.photo ? ((p.photo as Media).url ?? undefined) : undefined

/** A person's name linking to their page, in the site language. */
export function PersonLink({ person, className }: { person: Person; className?: string }) {
  return (
    <Link className={className ?? 'underline-offset-4 hover:underline'} href={`/people/${person.slug}`}>
      {person.name}
    </Link>
  )
}

/**
 * The people behind an article — writers, then translators and other
 * credits — each with their photo, name (to their page) and role.
 */
export function ContributorList({ title, contributors }: { title: string; contributors: Contributor[] }) {
  if (!contributors.length) return null
  return (
    <section aria-label={title}>
      <p className="mb-3 font-mono text-[0.68rem] tracking-[0.14em] uppercase opacity-60">{title}</p>
      <ul className="space-y-3">
        {contributors.map(({ person, role }) => (
          <li key={`${person.id}-${role}`}>
            <Link className="group flex items-center gap-3" href={`/people/${person.slug}`}>
              <Avatar name={person.name} size="md" src={photoOf(person)} />
              <span className="min-w-0">
                <span className="block text-sm leading-snug font-medium underline-offset-4 group-hover:underline">
                  {person.name}
                </span>
                <span className="block text-xs text-[var(--text-muted)]">{role}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
