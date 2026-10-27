/** Shared across locales and surfaces. Never use an email as an avatar seed. */
export const personAvatarSeed = (id: string | number) => `person:${id}`
