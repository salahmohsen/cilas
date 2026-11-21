import type { UserMenuUser } from '@/components/arc/user-menu/user-menu'
import type { useSession } from '@/components/use-session'
import { personAvatarSeed } from '@/lib/avatar'

/** The account menu's user: the linked person's name and photo; an account with no person shows its email once, as its name. */
export const menuUser = (session: NonNullable<ReturnType<typeof useSession>>): UserMenuUser => {
  const person = typeof session.person === 'object' ? session.person : null
  const photo = typeof person?.photo === 'object' ? person.photo : null
  return {
    name: person?.name || session.email,
    email: person?.name ? session.email : undefined,
    fallbackSeed: person
      ? personAvatarSeed(person.id)
      : typeof session.person === 'number'
        ? personAvatarSeed(session.person)
        : `account:${session.id}`,
    avatarSrc: photo?.sizes?.thumbnail?.url || photo?.url || undefined,
  }
}
