import type { CollectionConfig } from 'payload'

export const PREVIEW_COLLECTIONS = ['courses', 'articles', 'programmes'] as const
export type PreviewCollection = (typeof PREVIEW_COLLECTIONS)[number]

export const previewUrl =
  (
    collection: PreviewCollection,
  ): NonNullable<NonNullable<CollectionConfig['admin']>['livePreview']>['url'] =>
  ({ data, locale }) =>
    `/api/preview?collection=${collection}&slug=${data?.slug ?? ''}&locale=${locale?.code ?? 'en'}`
