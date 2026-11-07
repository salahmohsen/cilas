import { getPerson } from '@/api/people.api'
import type { Locale } from '@/i18n/routing'
import { detailPath } from '@/lib/paths'
import { plainText } from '@/lib/plaintext'
import { buildPageMetadata } from '@/lib/seo'
import config from '@payload-config'
import type { Metadata } from 'next'
import { getPayload } from 'payload'

/** A person's page metadata. Shared with its share card. */
export async function personMetadata(locale: string, slug: string): Promise<Metadata> {
  const payload = await getPayload({ config })
  const person = await getPerson(payload, slug, locale as Locale)
  if (!person) return {}
  const description = person.bio
    ? plainText({ data: person.bio }).replace(/\s+/g, ' ').trim().slice(0, 160)
    : undefined
  const photo = typeof person.photo === 'object' ? person.photo?.url : undefined
  const title = `${person.name} · CILAS`
  const metadata = buildPageMetadata({
    title,
    description,
    image: photo,
    path: detailPath('people', String(person.slug)),
    locale,
  })
  return { ...metadata, twitter: { ...metadata.twitter, title, description } }
}
