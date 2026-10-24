import type { Payload } from 'payload'
import { getTranslations } from 'next-intl/server'

import type { Space, User } from '@/payload-types'
import { moderatorPeople } from '@/lib/spaces-data'
import { spaceRoster } from '@/lib/spaces-write'

import type { PersonCard } from './person-hover'

/**
 * Everyone in one space as the person card shows them, fellows first, then
 * by name; and the fellows' ids for the badge. One read for each page.
 */
export async function spacePeopleCards(
  payload: Payload,
  user: User,
  space: Space,
  locale: string,
): Promise<{ cards: PersonCard[]; byId: Map<number, PersonCard>; moderators: Set<number> }> {
  const [t, roster, moderators] = await Promise.all([
    getTranslations('Spaces'),
    spaceRoster({ payload, user, space: space.id, locale: locale === 'ar' ? 'ar' : 'en' }),
    moderatorPeople(payload, space),
  ])
  const cards = (roster.ok ? roster.data.members : [])
    .map((m) => ({
      id: m.personId,
      name: m.name,
      photo: m.photo?.url ?? null,
      role: moderators.has(m.personId) ? t('fellow') : t('member'),
      bio: m.bio,
      links: m.links,
      href: m.slug ? `/${locale}/people/${m.slug}` : null,
    }))
    .sort(
      (a, b) =>
        Number(moderators.has(b.id)) - Number(moderators.has(a.id)) ||
        a.name.localeCompare(b.name, locale),
    )
  return { cards, byId: new Map(cards.map((c) => [c.id, c])), moderators }
}
