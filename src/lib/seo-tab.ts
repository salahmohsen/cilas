import type { CollectionConfig, Field, GroupField, Plugin, TabsField } from 'payload'

/**
 * The SEO plugin appends its `meta` group after a collection's fields, below
 * its tabs. This moves that group into a tab named "SEO" at the end of the
 * collection's own tabs, so the form keeps all of its settings in tabs. The
 * field stays `meta`, so its data and paths do not change. Plugins run in
 * order: list this after `seoPlugin`.
 */
const isTabs = (field: Field): field is TabsField => field.type === 'tabs'
const isMeta = (field: Field): field is GroupField =>
  field.type === 'group' && 'name' in field && field.name === 'meta'

export const withSeoTab = (collection: CollectionConfig): CollectionConfig => {
  const meta = collection.fields.find(isMeta)
  const tabs = collection.fields.find(isTabs)
  if (!meta || !tabs)
    throw new Error(`${collection.slug}: needs the SEO plugin's meta group and a tabs field.`)
  return {
    ...collection,
    fields: collection.fields
      .filter((field) => field !== meta)
      .map((field) =>
        field === tabs
          ? {
              ...tabs,
              tabs: [
                ...tabs.tabs,
                // The tab says "SEO", so the group needs no heading of its own.
                {
                  label: 'SEO',
                  fields: [{ ...meta, label: false, admin: { ...meta.admin, hideGutter: true } }],
                },
              ],
            }
          : field,
      ),
  }
}

export const seoTabFor =
  (slugs: readonly string[]): Plugin =>
  (config) => ({
    ...config,
    collections: config.collections?.map((collection) =>
      slugs.includes(collection.slug) ? withSeoTab(collection) : collection,
    ),
  })
