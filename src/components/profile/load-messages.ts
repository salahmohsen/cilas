import { getTranslations } from 'next-intl/server'

import { PROFILE_ERROR_KEYS, PROFILE_MESSAGE_KEYS, type ProfileMessages } from './messages'

/** The profile form's words in the request's language, for the page and the space drawer. */
export async function profileMessages(): Promise<ProfileMessages> {
  const t = await getTranslations('Profile')
  const pick = <K extends string>(keys: readonly K[], prefix = '') =>
    Object.fromEntries(
      keys.map((k) => [k, (t as (key: string) => string)(`${prefix}${k}`)]),
    ) as Record<K, string>
  return { ...pick(PROFILE_MESSAGE_KEYS), errors: pick(PROFILE_ERROR_KEYS, 'errors.') }
}
