import type { CollectionConfig } from 'payload'
import { localeOf } from '@/i18n/routing'

export const PREVIEW_COLLECTIONS = ['courses', 'articles', 'programmes'] as const
export type PreviewCollection = (typeof PREVIEW_COLLECTIONS)[number]

export const isPreviewCollection = (value: unknown): value is PreviewCollection =>
  PREVIEW_COLLECTIONS.some((collection) => collection === value)

export const previewUrl =
  (
    collection: PreviewCollection,
  ): NonNullable<NonNullable<CollectionConfig['admin']>['livePreview']>['url'] =>
  ({ data, locale }) =>
    `/api/preview?collection=${collection}&slug=${data?.slug ?? ''}&locale=${localeOf(locale?.code)}`
