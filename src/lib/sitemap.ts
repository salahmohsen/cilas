import { routing } from '@/i18n/routing'
import type { MetadataRoute } from 'next'

export type SitePage = { path: string; lastModified?: string | Date | null }

const LOCALES = routing.locales

/**
 * Sitemap entries for pages that exist in both site languages (ADR 0006):
 * one entry per language, each naming the other with hreflang, English as
 * the default.
 */
export const sitemapEntries = (site: string, pages: SitePage[]): MetadataRoute.Sitemap => {
  const origin = site.replace(/\/+$/, '')
  const urlOf = (locale: string, path: string) => `${origin}/${locale}${path}`
  return pages.flatMap(({ path, lastModified }) => {
    const languages = {
      ...Object.fromEntries(routing.locales.map((locale) => [locale, urlOf(locale, path)])),
      'x-default': urlOf(routing.defaultLocale, path),
    }
    return LOCALES.map((locale) => ({
      url: urlOf(locale, path),
      ...(lastModified ? { lastModified } : {}),
      alternates: { languages },
    }))
  })
}
