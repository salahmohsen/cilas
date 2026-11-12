import { notFound } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'
import { peoplePagesOf, type PeoplePageKey, type PeoplePages } from '@/lib/people-pages'

/** Which people pages are on (Site settings → People pages). */
export const getPeoplePages = async (): Promise<PeoplePages> => {
  const payload = await getPayload({ config })
  // A failed read (say, before its migration) keeps every page on.
  const settings = await payload.findGlobal({ slug: 'site-settings', depth: 0 }).catch(() => null)
  return peoplePagesOf(settings?.people_pages)
}

/** A people page that is off is not found. */
export const requirePeoplePage = async (key: PeoplePageKey): Promise<void> => {
  if (!(await getPeoplePages())[key]) notFound()
}
