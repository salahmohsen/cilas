import { getTranslations } from 'next-intl/server'

import type { ResetMessages } from './reset-form'

const KEYS = [
  'title',
  'intro',
  'password',
  'confirm',
  'submit',
  'tooShort',
  'mismatch',
  'invalid',
  'failed',
  'requestNew',
  'showPassword',
  'hidePassword',
  'back',
] as const satisfies readonly (keyof ResetMessages)[]

/**
 * The text of the set-password form: the reset page's, with the keys a page
 * of its own (the welcome page) writes differently.
 */
export const resetMessages = async (page: 'Reset' | 'Welcome'): Promise<ResetMessages> => {
  const reset = await getTranslations('Reset')
  const own = page === 'Reset' ? reset : await getTranslations(page)
  return Object.fromEntries(
    KEYS.map((key) => [key, own.has(key) ? own(key) : reset(key)]),
  ) as ResetMessages
}
