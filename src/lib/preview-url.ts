import { localeOf } from '@/i18n/routing'

export const PREVIEW_COLLECTIONS = ['courses', 'articles', 'programmes', 'forms'] as const
export type PreviewCollection = (typeof PREVIEW_COLLECTIONS)[number]

export const isPreviewCollection = (value: unknown): value is PreviewCollection =>
  PREVIEW_COLLECTIONS.some((collection) => collection === value)

export const previewUrl =
  (collection: PreviewCollection) =>
  ({ data, locale }: { data: Record<string, unknown>; locale?: { code?: string } | null }) =>
    `/api/preview?collection=${collection}&${collection === 'forms' ? `id=${data?.id ?? ''}` : `slug=${encodeURIComponent(String(data?.slug ?? ''))}`}&locale=${localeOf(locale?.code)}`
