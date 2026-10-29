import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import {
  commitTransaction,
  createLocalReq,
  initTransaction,
  killTransaction,
  type Payload,
} from 'payload'
import { z } from 'zod'

import { personOf } from '@/access'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { User } from '@/payload-types'
import { profileBioReadOnly, protectedBioText } from '@/lib/profile-rich-text'

type Locale = 'en' | 'ar'
type SocialLink = { platform: (typeof SOCIAL_PLATFORMS)[number]; url: string }

/** What the profile page shows and edits: the member's own person. */
export type ProfileView = {
  personId: number
  /** Whether the person is on the public site. Only an admin changes it. */
  visible: boolean
  name: Record<Locale, string>
  /** The bio as Markdown, per language. */
  bio: Record<Locale, string>
  bioReadOnly?: Record<Locale, boolean>
  website: string
  socialLinks: SocialLink[]
  photo: { url: string; alt: string } | null
}

export type ProfileInput = {
  name: Record<Locale, string>
  bio: Record<Locale, string>
  website: string
  socialLinks: SocialLink[]
}

/** A field the page names in its error message, or the account has no person. */
export type ProfileError = 'name' | 'bio' | 'website' | 'social' | 'name-ar' | 'photo' | 'no-person'

// Same rule as the collection's own URL validator, so Payload never rejects what passes here.
const httpUrl = z
  .url()
  .trim()
  .regex(/^https?:\/\/\S+$/i)

const unixEol = (value: string): string => value.replace(/\r\n?/g, '\n')

const schema = z.object({
  name: z.object({ en: z.string().trim().min(1).max(120), ar: z.string().trim().max(120) }),
  // Browsers send multi-line values with \r\n; stored bios export with \n.
  bio: z.object({
    en: z.string().max(5000).transform(unixEol),
    ar: z.string().max(5000).transform(unixEol),
  }),
  website: z.union([z.literal(''), httpUrl]),
  socialLinks: z.array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: httpUrl })).max(8),
})

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 5 * 1024 * 1024

const FIELD_ERROR: Record<keyof ProfileInput, ProfileError> = {
  name: 'name',
  bio: 'bio',
  website: 'website',
  socialLinks: 'social',
}

// Members must not embed uploads by id: `![collection:id]()` placeholders are dropped.
// The pattern is the one Payload's own Markdown import uses for uploads.
const UPLOAD_PLACEHOLDER = /!\[[^\]:]+:[^\]]+\]\(\)/g
const stripUploads = (markdown: string): string => markdown.replace(UPLOAD_PLACEHOLDER, '')

/** True when every Markdown link or image points at http:, https: or mailto:. */
const linksAreSafe = (markdown: string): boolean =>
  [...markdown.matchAll(/\]\(\s*<?([^)\s>]*)/g)].every(([, url]) =>
    /^(https?:|mailto:)/i.test(url ?? ''),
  )

// The `bio` field uses the global `lexicalEditor()`, so the default editor config matches it.
const editorConfig = (payload: Payload) => editorConfigFactory.default({ config: payload.config })

const toMarkdown = async (payload: Payload, data: unknown): Promise<string> =>
  data && typeof data === 'object' && 'root' in data
    ? convertLexicalToMarkdown({
        data: data as SerializedEditorState,
        editorConfig: await editorConfig(payload),
      }).trim()
    : ''

const toLexical = async (payload: Payload, markdown: string) =>
  markdown.trim()
    ? convertMarkdownToLexical({ editorConfig: await editorConfig(payload), markdown })
    : null

const textOf = (value: unknown, locale: Locale): string =>
  value && typeof value === 'object' ? String((value as Record<string, unknown>)[locale] ?? '') : ''

/** The member's own person as the member sees it, with each bio exported to Markdown. */
const loadOwn = async (payload: Payload, user: User, id: number) => {
  const person = await payload.findByID({
    collection: 'people',
    id,
    locale: 'all',
    depth: 1,
    // The profile edits the person only. A joined enrollment's empty localized rich text
    // breaks Payload's afterRead under `locale: 'all'`, so a student's profile would not open.
    joins: false,
    user,
    overrideAccess: false,
  })
  const bio = (person as { bio?: Record<string, unknown> }).bio
  return {
    person,
    bio: {
      en: profileBioReadOnly(bio?.en)
        ? protectedBioText(bio?.en)
        : await toMarkdown(payload, bio?.en),
      ar: profileBioReadOnly(bio?.ar)
        ? protectedBioText(bio?.ar)
        : await toMarkdown(payload, bio?.ar),
    },
    bioReadOnly: { en: profileBioReadOnly(bio?.en), ar: profileBioReadOnly(bio?.ar) },
  }
}

/**
 * The signed-in member's own person, as the profile page edits it, or null
 * when the account has no person. Read through access rules, as the member.
 */
export const readProfile = async (payload: Payload, user: User): Promise<ProfileView | null> => {
  const id = personOf(user)
  if (id === null) return null
  const { person, bio, bioReadOnly } = await loadOwn(payload, user, id)
  const photo = typeof person.photo === 'object' && person.photo?.url ? person.photo : null
  return {
    personId: person.id,
    visible: Boolean(person.visible),
    name: { en: textOf(person.name, 'en'), ar: textOf(person.name, 'ar') },
    bio,
    bioReadOnly,
    website: person.website ?? '',
    socialLinks: (person.social_links ?? []).map(({ platform, url }) => ({ platform, url })),
    photo: photo ? { url: photo.url!, alt: photo.alt } : null,
  }
}

/**
 * Saves the member's own name, bio, links and photo. Everything goes through
 * the collection's access rules as the member: `visible` is admin-only there,
 * so it is never written from here, whatever the input holds.
 */
export const saveProfile = async (
  payload: Payload,
  user: User,
  input: ProfileInput,
  photo?: { data: Buffer; mimetype: string; name: string; size: number },
): Promise<{ ok: true } | { ok: false; error: ProfileError }> => {
  const id = personOf(user)
  if (id === null) return { ok: false, error: 'no-person' }

  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path[0] as keyof ProfileInput | undefined
    return { ok: false, error: (field && FIELD_ERROR[field]) || 'name' }
  }
  const { name, bio, website, socialLinks } = parsed.data

  // Check the photo first, so a refused file never costs a write.
  // The size comes from the bytes, not from what the client claims.
  if (photo && (!PHOTO_TYPES.includes(photo.mimetype) || photo.data.length > PHOTO_MAX_BYTES)) {
    return { ok: false, error: 'photo' }
  }

  const { person: stored, bio: storedBio, bioReadOnly } = await loadOwn(payload, user, id)

  // Payload refuses an empty required name in Arabic, so a stored one cannot be cleared here.
  if (!name.ar && textOf(stored.name, 'ar')) return { ok: false, error: 'name-ar' }

  // Write a bio only when the member changed it: Markdown cannot carry every
  // node an admin may have used, so an untouched bio must not be rewritten.
  const bioData: Partial<Record<Locale, Awaited<ReturnType<typeof toLexical>>>> = {}
  for (const locale of ['en', 'ar'] as const) {
    const markdown = bio[locale].trim()
    if (markdown === storedBio[locale]) continue
    if (bioReadOnly[locale]) return { ok: false, error: 'bio' }
    const clean = stripUploads(markdown)
    if (!linksAreSafe(clean)) return { ok: false, error: 'bio' }
    bioData[locale] = await toLexical(payload, clean)
  }

  const req = await createLocalReq({ user }, payload)
  const started = await initTransaction(req)
  let mediaId: number | undefined
  try {
    let photoId: number | undefined
    if (photo) {
      try {
        const media = await payload.create({
          collection: 'media',
          data: { alt: name.en },
          file: photo,
          req,
          user,
          overrideAccess: false,
        })
        mediaId = media.id
        photoId = media.id
      } catch {
        if (started) await killTransaction(req)
        return { ok: false, error: 'photo' }
      }
    }

    const asMember = { collection: 'people', id, req, user, overrideAccess: false } as const
    await payload.update({
      ...asMember,
      locale: 'en',
      data: {
        name: name.en,
        ...('en' in bioData ? { bio: bioData.en } : {}),
        website: website || null,
        social_links: socialLinks,
        ...(photoId ? { photo: photoId } : {}),
      },
    })
    // An empty Arabic name is left alone (it is empty already); the site falls back to English.
    const arData = {
      ...(name.ar ? { name: name.ar } : {}),
      ...('ar' in bioData ? { bio: bioData.ar } : {}),
    }
    if (Object.keys(arData).length) {
      await payload.update({ ...asMember, locale: 'ar', data: arData })
    }
    if (started) await commitTransaction(req)
  } catch (error) {
    // If Postgres aborted the transaction, this delete fails too and the stored file stays.
    // Delete the media row inside the transaction, with the same req, so the
    // storage plugin's delete hook removes the stored file as well.
    if (mediaId) {
      await payload
        .delete({ collection: 'media', id: mediaId, req, overrideAccess: true })
        .catch(() => undefined)
    }
    if (started) await killTransaction(req)
    throw error
  }
  return { ok: true }
}

/**
 * Sets or removes the member's own photo, on its own, as the avatar upload
 * saves it the moment it is cropped. Null removes it. The checks are the
 * profile form's: kind and size from the bytes, then the media collection's own.
 */
export const saveProfilePhoto = async (
  payload: Payload,
  user: User,
  photo: { data: Buffer; mimetype: string; name: string; size: number } | null,
): Promise<{ ok: true; url: string | null } | { ok: false; error: ProfileError }> => {
  const id = personOf(user)
  if (id === null) return { ok: false, error: 'no-person' }
  if (photo && (!PHOTO_TYPES.includes(photo.mimetype) || photo.data.length > PHOTO_MAX_BYTES)) {
    return { ok: false, error: 'photo' }
  }
  const asMember = { collection: 'people', id, user, overrideAccess: false } as const
  if (!photo) {
    await payload.update({ ...asMember, locale: 'en', data: { photo: null } })
    return { ok: true, url: null }
  }

  const { person } = await loadOwn(payload, user, id)
  const req = await createLocalReq({ user }, payload)
  const started = await initTransaction(req)
  let media: { id: number; url?: string | null } | undefined
  try {
    try {
      media = await payload.create({
        collection: 'media',
        data: { alt: textOf(person.name, 'en') || 'Photo' },
        file: photo,
        req,
        user,
        overrideAccess: false,
      })
    } catch {
      if (started) await killTransaction(req)
      return { ok: false, error: 'photo' }
    }
    await payload.update({ ...asMember, req, locale: 'en', data: { photo: media.id } })
    if (started) await commitTransaction(req)
  } catch (error) {
    // As in saveProfile: delete with the same req so the stored file goes too.
    if (media) {
      await payload
        .delete({ collection: 'media', id: media.id, req, overrideAccess: true })
        .catch(() => undefined)
    }
    if (started) await killTransaction(req)
    throw error
  }
  return { ok: true, url: media.url ?? null }
}
