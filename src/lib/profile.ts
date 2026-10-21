import {
  convertLexicalToMarkdown,
  convertMarkdownToLexical,
  editorConfigFactory,
} from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'
import { z } from 'zod'

import { personOf } from '@/access'
import { SOCIAL_PLATFORMS } from '@/fields/social'
import type { User } from '@/payload-types'

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
export type ProfileError = 'name' | 'bio' | 'website' | 'social' | 'photo' | 'no-person'

const httpUrl = z
  .string()
  .trim()
  .url()
  .regex(/^https?:\/\//i)

const schema = z.object({
  name: z.object({ en: z.string().trim().min(1).max(120), ar: z.string().trim().max(120) }),
  bio: z.object({ en: z.string().max(5000), ar: z.string().max(5000) }),
  website: z.union([z.literal(''), httpUrl]),
  socialLinks: z.array(z.object({ platform: z.enum(SOCIAL_PLATFORMS), url: httpUrl })).max(8),
})

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const PHOTO_MAX_BYTES = 5 * 1024 * 1024

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

/**
 * The signed-in member's own person, as the profile page edits it, or null
 * when the account has no person. Read through access rules, as the member.
 */
export const readProfile = async (payload: Payload, user: User): Promise<ProfileView | null> => {
  const id = personOf(user)
  if (id === null) return null
  const person = await payload.findByID({
    collection: 'people',
    id,
    locale: 'all',
    depth: 1,
    user,
    overrideAccess: false,
  })
  const bio = (person as { bio?: unknown }).bio
  const photo = typeof person.photo === 'object' && person.photo?.url ? person.photo : null
  return {
    personId: person.id,
    visible: Boolean(person.visible),
    name: { en: textOf(person.name, 'en'), ar: textOf(person.name, 'ar') },
    bio: {
      en: await toMarkdown(payload, (bio as Record<string, unknown> | undefined)?.en),
      ar: await toMarkdown(payload, (bio as Record<string, unknown> | undefined)?.ar),
    },
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
    const field = String(parsed.error.issues[0]?.path[0] ?? 'name')
    return { ok: false, error: (field === 'socialLinks' ? 'social' : field) as ProfileError }
  }
  const { name, bio, website, socialLinks } = parsed.data

  let photoId: number | undefined
  if (photo) {
    if (!PHOTO_TYPES.includes(photo.mimetype) || photo.size > PHOTO_MAX_BYTES) {
      return { ok: false, error: 'photo' }
    }
    const media = await payload.create({
      collection: 'media',
      data: { alt: name.en },
      file: photo,
      user,
      overrideAccess: false,
    })
    photoId = media.id
  }

  const asMember = { collection: 'people', id, user, overrideAccess: false } as const
  await payload.update({
    ...asMember,
    locale: 'en',
    data: {
      name: name.en,
      bio: await toLexical(payload, bio.en),
      website: website || null,
      social_links: socialLinks,
      ...(photoId ? { photo: photoId } : {}),
    },
  })
  await payload.update({
    ...asMember,
    locale: 'ar',
    // An empty Arabic name falls back to the English one on the site.
    data: { ...(name.ar ? { name: name.ar } : {}), bio: await toLexical(payload, bio.ar) },
  })
  return { ok: true }
}
