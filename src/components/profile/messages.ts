import type { ProfileError } from '@/lib/profile'

export const PROFILE_MESSAGE_KEYS = [
  'public',
  'private',
  'nameEn',
  'nameAr',
  'bioEn',
  'bioAr',
  'bioReadOnly',
  'website',
  'social',
  'platform',
  'url',
  'addLink',
  'removeLink',
  'save',
  'saved',
  'nameLong',
  'linkEmpty',
  'linkInvalid',
] as const

/** Every error the server can name, so a missing one is a type error. */
export const PROFILE_ERROR_KEYS = [
  'name',
  'name-ar',
  'bio',
  'website',
  'social',
  'photo',
  'no-person',
] as const satisfies readonly ProfileError[]

export type ProfileMessages = Record<(typeof PROFILE_MESSAGE_KEYS)[number], string> & {
  errors: Record<ProfileError, string>
}
