import type { Plugin } from 'payload'
import { DEFAULT_SETTINGS_GLOBAL_SLUG, llmsTxtPlugin } from 'payload-plugin-llms-txt'
import type { LlmsTxtPluginOptions } from 'payload-plugin-llms-txt'

import { isAdmin } from '@/access'
import { env } from '@/env'

/**
 * /llms.txt and /llms-full.txt: the public courses, articles and people, as
 * an anonymous visitor reads them (the plugin reads with access on), in
 * English. The Arabic pages are one switch away on each linked page.
 */
export const llmsOptions: LlmsTxtPluginOptions = {
  siteName: 'CILAS: Cairo Institute for Liberal Arts and Sciences',
  siteDescription:
    'An independent school in Cairo that runs seasonal cycles of courses, longer programmes such as the Bridge, and publishes work by its community. Its archive goes back to 2013.',
  siteURL: env.NEXT_PUBLIC_SERVER_URL,
  enableFullText: true,
  addSettingsGlobal: true,
  collections: [
    {
      slug: 'courses',
      label: 'Courses',
      descriptionField: ['summary', 'subtitle', 'meta.description'],
      contentField: 'description',
      urlPath: (doc) => `/en/study/${doc.slug}`,
    },
    {
      slug: 'articles',
      label: 'Articles',
      descriptionField: ['meta.description'],
      contentField: 'body',
      urlPath: (doc) => `/en/articles/${doc.slug}`,
    },
    {
      slug: 'people',
      label: 'People',
      titleField: 'name',
      contentField: 'bio',
      // People have no drafts; hidden people are kept out by access.
      publishedOnly: false,
      urlPath: (doc) => `/en/people/${doc.slug}`,
    },
  ],
}

/** The plugin, with its settings global editable by admins only and kept with Site. */
export const llmsTxt = (): Plugin => (config) => {
  const next = llmsTxtPlugin(llmsOptions)(config) as typeof config
  return {
    ...next,
    globals: next.globals?.map((g) =>
      g.slug === DEFAULT_SETTINGS_GLOBAL_SLUG
        ? { ...g, admin: { ...g.admin, group: 'Site' }, access: { ...g.access, update: isAdmin } }
        : g,
    ),
  }
}
