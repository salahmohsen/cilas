import { blobatarUri } from 'blobatar/uri'

/** Shared across locales and surfaces. Never use an email as an avatar seed. */
export const personAvatarSeed = (id: string | number) => `person:${id}`

/** Generated entirely locally; the seed is hashed by Blobatar, never sent to a service. */
export const avatarFallback = (seed: string) => blobatarUri(seed.trim() || 'anonymous')
