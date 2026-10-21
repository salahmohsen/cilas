'use server'

import config from '@payload-config'
import { refresh } from 'next/cache'
import { getPayload } from 'payload'

import { saveProfile, type ProfileError, type ProfileInput } from '@/lib/profile'
import { currentReader } from '@/lib/reader'

export type ProfileState = { status: 'idle' | 'saved' } | { status: 'error'; error: ProfileError }

const text = (form: FormData, key: string) => String(form.get(key) ?? '')

/** The profile form's submit: the signed-in member saves their own person. */
export async function saveProfileAction(
  _previous: ProfileState,
  form: FormData,
): Promise<ProfileState> {
  const user = await currentReader()
  if (!user) return { status: 'error', error: 'no-person' }

  let socialLinks: ProfileInput['socialLinks'] = []
  try {
    socialLinks = JSON.parse(text(form, 'socialLinks') || '[]')
  } catch {
    return { status: 'error', error: 'social' }
  }
  const input: ProfileInput = {
    name: { en: text(form, 'name_en'), ar: text(form, 'name_ar') },
    bio: { en: text(form, 'bio_en'), ar: text(form, 'bio_ar') },
    website: text(form, 'website'),
    socialLinks,
  }
  const file = form.get('photo')
  const photo =
    file instanceof File && file.size > 0
      ? {
          data: Buffer.from(await file.arrayBuffer()),
          mimetype: file.type,
          name: file.name,
          size: file.size,
        }
      : undefined

  const payload = await getPayload({ config })
  const result = await saveProfile(payload, user, input, photo)
  if (!result.ok) return { status: 'error', error: result.error }
  // Bring the stored values and the new photo to the page.
  refresh()
  return { status: 'saved' }
}
