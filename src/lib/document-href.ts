import { clientEnv } from '@/env.client'
import type { Locale } from '@/i18n/routing'

import type { ReviewedCollection } from './reviewed-fields'

export type DocumentTarget = {
  collection: ReviewedCollection | 'users'
  id: number
  viewer: 'owner' | 'admin'
  waiting: boolean
}

/** The locale-free path to a document for this viewer. */
export const documentHref = ({ collection, id }: DocumentTarget): string =>
  `/admin/collections/${collection}/${id}`

export const applicantsHref = (target: { application: number } | { course: number }): string =>
  '/admin/applicants?' +
  ('application' in target ? `application=${target.application}` : `course=${target.course}`)

export const localizedLink = (path: string, locale: Locale): string =>
  /^\/spaces(?:[/?#]|$)/.test(path) ? `/${locale}${path}` : path

export const absoluteLink = (path: string, locale: Locale): string =>
  `${clientEnv.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')}${localizedLink(path, locale)}`

/** The admin page that creates a document. */
export const adminCreateHref = (collection: ReviewedCollection): string =>
  `/admin/collections/${collection}/create`
