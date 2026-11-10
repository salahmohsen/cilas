import { localeOf } from '@/i18n/routing'

export const PREVIEW_TARGET_FIELDS = {
  courses: 'slug',
  articles: 'slug',
  programmes: 'slug',
  forms: 'id',
} as const
export type PreviewCollection = keyof typeof PREVIEW_TARGET_FIELDS
export const PREVIEW_COLLECTIONS = Object.keys(PREVIEW_TARGET_FIELDS) as PreviewCollection[]

export const isPreviewCollection = (value: unknown): value is PreviewCollection =>
  typeof value === 'string' && Object.hasOwn(PREVIEW_TARGET_FIELDS, value)

export const previewUrl =
  (collection: PreviewCollection) =>
  ({ data, locale }: { data: Record<string, unknown>; locale?: { code?: string } | null }) => {
    const field = PREVIEW_TARGET_FIELDS[collection]
    const target = encodeURIComponent(String(data?.[field] ?? ''))
    return `/api/preview?collection=${collection}&${field}=${target}&locale=${localeOf(locale?.code)}`
  }
