// @vitest-environment node
// Boots the real config against DATABASE_URL.
import { readFile } from 'node:fs/promises'
import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { readProfile, saveProfile, saveProfilePhoto, type ProfileInput } from '@/lib/profile'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { RUN, createTracker, uniq } from './fixtures'

let payload: Payload
const people: number[] = []
const { track, cleanup } = createTracker()
// The bio tests that hold an uploaded image need a media row; they make it.
let mediaId: number

describe('profile', () => {
  let me: User
  let otherId: number

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const mine = await payload.create({
      collection: 'people',
      data: { name: 'Profile Probe', slug: uniq('profile-probe') },
      overrideAccess: true,
    })
    const other = await payload.create({
      collection: 'people',
      data: { name: 'Profile Other', slug: uniq('profile-other') },
      overrideAccess: true,
    })
    people.push(mine.id, other.id)
    otherId = other.id
    me = { id: -3, roles: ['member'], person: mine.id, collection: 'users' } as unknown as User
    const data = await readFile(new URL('../fixtures/pixel.png', import.meta.url))
    mediaId = track(
      'media',
      await payload.create({
        collection: 'media',
        data: { alt: 'Profile probe image' },
        file: { name: `pixel-${RUN}.png`, mimetype: 'image/png', data, size: data.length },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    await cleanup(payload)
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
    await payload
      .update({
        collection: 'people',
        id: people[0]!,
        data: { visible: true },
        user: me,
        overrideAccess: false,
      })
      .catch(() => undefined)
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

  const base = (over: Partial<ProfileInput> = {}): ProfileInput => ({
    name: { en: 'Nour Probe', ar: 'نور' },
    bio: { en: '', ar: '' },
    website: '',
    socialLinks: [],
    ...over,
  })

  it('returns social and website errors instead of throwing', async () => {
    expect(
      await saveProfile(
        payload,
        me,
        base({ socialLinks: [{ platform: 'instagram', url: 'ftp://x' }] }),
      ),
    ).toEqual({ ok: false, error: 'social' })
    const nine = Array.from({ length: 9 }, () => ({
      platform: 'instagram' as const,
      url: 'https://a.com',
    }))
    expect(await saveProfile(payload, me, base({ socialLinks: nine }))).toEqual({
      ok: false,
      error: 'social',
    })
    expect(await saveProfile(payload, me, base({ website: 'https://a.com/x y' }))).toEqual({
      ok: false,
      error: 'website',
    })
    expect(
      await saveProfile(
        payload,
        me,
        base({ socialLinks: [{ platform: 'instagram', url: 'https://a.com/x y' }] }),
      ),
    ).toEqual({ ok: false, error: 'social' })
  })

  it('refuses a photo of the wrong type or size', async () => {
    const gif = { data: Buffer.from('GIF89a'), mimetype: 'image/gif', name: 'a.gif', size: 6 }
    expect(await saveProfile(payload, me, base(), gif)).toEqual({ ok: false, error: 'photo' })
    const big = Buffer.alloc(6 * 1024 * 1024)
    const lie = { data: big, mimetype: 'image/png', name: 'a.png', size: 10 }
    expect(await saveProfile(payload, me, base(), lie)).toEqual({ ok: false, error: 'photo' })
  })

  it('refuses a photo alone of the wrong type or size, and removes the photo', async () => {
    const gif = { data: Buffer.from('GIF89a'), mimetype: 'image/gif', name: 'a.gif', size: 6 }
    expect(await saveProfilePhoto(payload, me, gif)).toEqual({ ok: false, error: 'photo' })
    const big = {
      data: Buffer.alloc(6 * 1024 * 1024),
      mimetype: 'image/jpeg',
      name: 'a.jpg',
      size: 1,
    }
    expect(await saveProfilePhoto(payload, me, big)).toEqual({ ok: false, error: 'photo' })
    expect(await saveProfilePhoto(payload, me, null)).toEqual({ ok: true, url: null })
    expect((await readProfile(payload, me))?.photo).toBeNull()
    const stranger = {
      id: -4,
      roles: ['member'],
      person: null,
      collection: 'users',
    } as unknown as User
    expect(await saveProfilePhoto(payload, stranger, null)).toEqual({
      ok: false,
      error: 'no-person',
    })
  })

  it('round-trips a Markdown bio with a link, a list and a heading', async () => {
    const md = '# Title\n\nSee [site](https://x.example)\n\n- one\n- two'
    expect(await saveProfile(payload, me, base({ bio: { en: md, ar: '' } }))).toEqual({ ok: true })
    const first = await readProfile(payload, me)
    expect(first?.bio.en).toContain('[site](https://x.example)')
    expect(first?.bio.en).toContain('# Title')
    await saveProfile(payload, me, base({ bio: { en: first!.bio.en, ar: first!.bio.ar } }))
    const second = await readProfile(payload, me)
    expect(second?.bio).toEqual(first?.bio)
  })

  it('keeps an unchanged admin-written bio', async () => {
    const underlined = {
      root: {
        type: 'root',
        format: '',
        indent: 0,
        version: 1,
        direction: 'ltr',
        children: [
          {
            type: 'paragraph',
            format: '',
            indent: 0,
            version: 1,
            direction: 'ltr',
            children: [
              {
                type: 'text',
                text: 'Underlined',
                format: 8,
                detail: 0,
                mode: 'normal',
                style: '',
                version: 1,
              },
            ],
          },
        ],
      },
    }
    await payload.update({
      collection: 'people',
      id: people[0]!,
      locale: 'en',
      data: { bio: underlined } as never,
      overrideAccess: true,
    })
    const view = await readProfile(payload, me)
    expect(
      await saveProfile(payload, me, base({ bio: view!.bio, website: 'https://changed.example' })),
    ).toEqual({ ok: true })
    const stored = await payload.findByID({
      collection: 'people',
      id: people[0]!,
      locale: 'en',
      overrideAccess: true,
    })
    expect(JSON.stringify((stored as { bio?: unknown }).bio)).toContain('"format":8')
    expect(stored.website).toBe('https://changed.example')
  })

  it('refuses a bio link that is not http, https or mailto', async () => {
    expect(
      await saveProfile(payload, me, base({ bio: { en: '[x](javascript:alert(1))', ar: '' } })),
    ).toEqual({ ok: false, error: 'bio' })
  })

  // Earlier tests leave a read-only bio (underlined text) on the person; the
  // tests that write a bio start from an empty one.
  const clearBio = async () => {
    for (const locale of ['en', 'ar'] as const) {
      await payload.update({
        collection: 'people',
        id: people[0]!,
        locale,
        data: { bio: null },
        overrideAccess: true,
      })
    }
  }

  it('refuses to clear a stored Arabic name', async () => {
    await clearBio()
    expect(await saveProfile(payload, me, base({ name: { en: 'Nour Probe', ar: 'نور' } }))).toEqual(
      {
        ok: true,
      },
    )
    expect(await saveProfile(payload, me, base({ name: { en: 'Nour Probe', ar: '' } }))).toEqual({
      ok: false,
      error: 'name-ar',
    })
  })

  const lexicalOf = (
    ...paragraphs: Array<{ text: string; format: number } | { upload: number }>
  ) => ({
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction: 'ltr',
      children: paragraphs.map((item) =>
        'upload' in item
          ? {
              type: 'upload',
              relationTo: 'media',
              value: item.upload,
              fields: {},
              version: 3,
              format: '',
            }
          : {
              type: 'paragraph',
              format: '',
              indent: 0,
              version: 1,
              direction: 'ltr',
              children: [
                {
                  type: 'text',
                  text: item.text,
                  format: item.format,
                  detail: 0,
                  mode: 'normal',
                  style: '',
                  version: 1,
                },
              ],
            },
      ),
    },
  })

  const storedBio = async () =>
    JSON.stringify(
      (
        (await payload.findByID({
          collection: 'people',
          id: people[0]!,
          locale: 'en',
          overrideAccess: true,
        })) as { bio?: unknown }
      ).bio,
    )

  it('keeps an unchanged bio with CRLF line endings', async () => {
    await payload.update({
      collection: 'people',
      id: people[0]!,
      locale: 'en',
      data: { bio: lexicalOf({ text: 'One', format: 8 }, { text: 'Two', format: 8 }) } as never,
      overrideAccess: true,
    })
    const view = await readProfile(payload, me)
    const crlf = view!.bio.en.replace(/\n/g, '\r\n')
    expect(await saveProfile(payload, me, base({ bio: { en: crlf, ar: view!.bio.ar } }))).toEqual({
      ok: true,
    })
    expect(await storedBio()).toContain('"format":8')
  })

  it('drops upload placeholders from a member bio', async () => {
    await clearBio()
    const id = mediaId
    expect(
      await saveProfile(
        payload,
        me,
        base({ bio: { en: `Hello\n\n![media:${id}]()\n\n![ media:${id}]()`, ar: '' } }),
      ),
    ).toEqual({ ok: true })
    const stored = await storedBio()
    expect(stored).toContain('Hello')
    expect(stored).not.toContain('"type":"upload"')
  })

  it('keeps an unchanged bio that holds an uploaded image', async () => {
    await payload.update({
      collection: 'people',
      id: people[0]!,
      locale: 'en',
      data: { bio: lexicalOf({ text: 'Before', format: 0 }, { upload: mediaId }) } as never,
      overrideAccess: true,
    })
    const view = await readProfile(payload, me)
    expect(
      await saveProfile(payload, me, base({ bio: view!.bio, website: 'https://image.example' })),
    ).toEqual({ ok: true })
    expect(await storedBio()).toContain('"type":"upload"')
  })
})
