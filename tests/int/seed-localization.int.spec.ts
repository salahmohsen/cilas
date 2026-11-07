// @vitest-environment node
// Server-side: touches the database.
import { getPayload } from 'payload'
import type { Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import { lexical } from '../../seed/seed.utils'
import { uniq } from './fixtures'

/**
 * Regression cover for the seeder's localized profile fields: a person is
 * created in English, then gets an Arabic pass. Both locales must survive.
 *
 * Needs a reachable DATABASE_URL.
 */
let payload: Payload
let personId: number

type LocalizedPerson = {
  name: { en: string; ar: string }
  bio: { en: unknown; ar: { root: { direction: string } } }
}

const bioText = (bio: unknown): string => {
  const root = (bio as { root?: { children?: Array<{ children?: Array<{ text?: string }> }> } })
    ?.root
  return root?.children?.[0]?.children?.[0]?.text ?? ''
}

const read = async (): Promise<LocalizedPerson> =>
  (await payload.findByID({
    collection: 'people',
    id: personId,
    depth: 0,
    locale: 'all',
    overrideAccess: true,
  })) as unknown as LocalizedPerson

describe('seed localization', () => {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const person = await payload.create({
      collection: 'people',
      data: { name: 'Probe Fellow', slug: uniq('probe-fellow'), bio: lexical('English bio.') },
      overrideAccess: true,
    })
    personId = person.id
    await payload.update({
      collection: 'people',
      id: personId,
      data: { name: 'زميل الاختبار', bio: lexical('سيرة ذاتية بالعربية.', 'rtl') },
      locale: 'ar',
      overrideAccess: true,
    })
  })

  afterAll(async () => {
    await payload.delete({ collection: 'people', id: personId, overrideAccess: true })
    await payload.destroy()
  })

  it('keeps name and bio in English and Arabic', async () => {
    const person = await read()

    expect(person.name).toEqual({ en: 'Probe Fellow', ar: 'زميل الاختبار' })
    expect(bioText(person.bio.en)).toBe('English bio.')
    expect(bioText(person.bio.ar)).toBe('سيرة ذاتية بالعربية.')
  })

  it('marks the Arabic bio as rtl so Lexical renders the direction', async () => {
    const person = await read()

    expect(person.bio.ar.root.direction).toBe('rtl')
  })
})
