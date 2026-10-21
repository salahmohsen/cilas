// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readProfile, saveProfile } from '@/lib/profile'
import config from '@/payload.config'
import type { User } from '@/payload-types'

let payload: Payload
const people: number[] = []

describe('profile', () => {
  let me: User
  let otherId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mine = await payload.create({
      collection: 'people',
      data: { name: 'Profile Probe', slug: 'profile-probe' },
      overrideAccess: true,
    })
    const other = await payload.create({
      collection: 'people',
      data: { name: 'Profile Other', slug: 'profile-other' },
      overrideAccess: true,
    })
    people.push(mine.id, other.id)
    otherId = other.id
    me = { id: -3, roles: ['member'], person: mine.id, collection: 'users' } as unknown as User
  })

  afterAll(async () => {
    for (const id of people) {
      await payload
        .delete({ collection: 'people', id, overrideAccess: true })
        .catch(() => undefined)
    }
    await payload.destroy()
  })

  it('saves both names, a Markdown bio and links, and reads them back', async () => {
    const result = await saveProfile(payload, me, {
      name: { en: 'Nour Probe', ar: 'نور' },
      bio: { en: 'I read **Fanon**.', ar: 'أقرأ فانون.' },
      website: 'https://nour.example',
      socialLinks: [{ platform: 'instagram', url: 'https://instagram.com/nour' }],
    })
    expect(result).toEqual({ ok: true })

    const view = await readProfile(payload, me)
    expect(view?.name).toEqual({ en: 'Nour Probe', ar: 'نور' })
    expect(view?.bio.en).toContain('**Fanon**')
    expect(view?.bio.ar).toContain('أقرأ فانون')
    expect(view?.website).toBe('https://nour.example')
    expect(view?.socialLinks).toEqual([
      { platform: 'instagram', url: 'https://instagram.com/nour' },
    ])
    expect(view?.visible).toBe(false)
  })

  it('never makes the member public', async () => {
    await saveProfile(payload, me, {
      name: { en: 'Nour Probe', ar: '' },
      bio: { en: '', ar: '' },
      website: '',
      socialLinks: [],
      visible: true,
    } as never)
    const person = await payload.findByID({
      collection: 'people',
      id: people[0]!,
      overrideAccess: true,
    })
    expect(person.visible).toBe(false)
  })

  it('refuses an empty English name and a link that is not http(s)', async () => {
    const empty = await saveProfile(payload, me, {
      name: { en: ' ', ar: '' },
      bio: { en: '', ar: '' },
      website: '',
      socialLinks: [],
    })
    expect(empty).toEqual({ ok: false, error: 'name' })
    const bad = await saveProfile(payload, me, {
      name: { en: 'Nour', ar: '' },
      bio: { en: '', ar: '' },
      website: 'javascript:alert(1)',
      socialLinks: [],
    })
    expect(bad).toEqual({ ok: false, error: 'website' })
  })

  it('edits only the member’s own person', async () => {
    // saveProfile always writes personOf(user); the collection rule is what
    // keeps a member off everyone else's person.
    await expect(
      payload.update({
        collection: 'people',
        id: otherId,
        data: { name: 'Hijacked' },
        user: me,
        overrideAccess: false,
      }),
    ).rejects.toThrow()
    const other = await payload.findByID({
      collection: 'people',
      id: otherId,
      overrideAccess: true,
    })
    expect(other.name).toBe('Profile Other')

    // An account with no person gets nothing.
    const nobody = {
      id: -4,
      roles: ['member'],
      person: null,
      collection: 'users',
    } as unknown as User
    expect(await readProfile(payload, nobody)).toBeNull()
    expect(
      await saveProfile(payload, nobody, {
        name: { en: 'X', ar: '' },
        bio: { en: '', ar: '' },
        website: '',
        socialLinks: [],
      }),
    ).toEqual({ ok: false, error: 'no-person' })
  })
})
