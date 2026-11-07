import { detailPath } from '@/lib/paths'
import type { Payload } from 'payload'
import { getTranslations } from 'next-intl/server'

import { personOf } from '@/access'
import type { Space, User } from '@/payload-types'
import { peopleRows, staffPersonIds } from '@/lib/space-members'
import { moderatorPeople } from '@/lib/spaces-data'
import { spaceRoster } from '@/lib/spaces-write'

import type { PersonCard } from './person-hover'

/**
 * Everyone in one space as the person card shows them, fellows first, then
 * by name; and the fellows' ids for the badge. One read for each page.
 * `byId` also knows the CILAS team and the reader, who post and comment in a
 * space without being in its member list.
 */
export async function spacePeopleCards(
  payload: Payload,
  user: User,
  space: Space,
  locale: string,
): Promise<{ cards: PersonCard[]; byId: Map<number, PersonCard>; moderators: Set<number> }> {
  const lang = locale === 'ar' ? 'ar' : 'en'
  const [t, roster, moderators, staff] = await Promise.all([
    getTranslations('Spaces'),
    spaceRoster({ payload, user, space: space.id, locale: lang }),
    moderatorPeople(payload, space),
    staffPersonIds(payload),
  ])
  const cards = (roster.ok ? roster.data.members : [])
    .map((m) => ({
      id: m.personId,
      name: m.name,
      photo: m.photo?.url ?? null,
      role: moderators.has(m.personId) ? t('fellow') : t('member'),
      bio: m.bio,
      links: m.links,
      href: m.slug ? detailPath('people', String(m.slug), locale) : null,
    }))
    .sort(
      (a, b) =>
        Number(moderators.has(b.id)) - Number(moderators.has(a.id)) ||
        a.name.localeCompare(b.name, locale),
    )
  const byId = new Map(cards.map((c) => [c.id, c]))
  const viewer = personOf(user)
  const outside = [...new Set([...staff, ...(viewer ? [viewer] : [])])].filter(
    (id) => !byId.has(id),
  )
  const staffIds = new Set(staff)
  for (const p of await peopleRows(payload, outside, lang))
    byId.set(p.id, {
      id: p.id,
      name: p.name,
      photo: p.photo?.url ?? null,
      role: staffIds.has(p.id) ? t('team') : t('member'),
      bio: p.bio,
      links: p.links,
      href: p.visible && p.slug ? detailPath('people', String(p.slug), locale) : null,
    })
  return { cards, byId, moderators }
}
