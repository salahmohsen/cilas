import type { CollectionBeforeValidateHook } from 'payload'

import { localeOf } from '@/i18n/routing'

/**
 * Records the site language a new submission was made in. The form sends the
 * language it was shown in; anything that is not a site language becomes
 * English, so a bad value never fails the submission. Decision emails follow it.
 */
export const setSubmissionLocale: CollectionBeforeValidateHook = ({ data, operation }) =>
  operation === 'create' ? { ...data, locale: localeOf(data?.locale) } : data
