import type { CollectionAfterChangeHook, PayloadRequest, TypedLocale } from 'payload'

import { relId } from '@/lib/relation'
import type { Course, Programme } from '@/payload-types'

/** Set on `req.context` while refreshSpaceName writes, so the write does not refresh again. */
const WRITING = 'spaceNameWriting'

type SpaceRow = {
  kind: 'community' | 'course' | 'cohort'
  name?: string | null
  course?: unknown
  programme?: unknown
  display_name?: string | null
}

/**
 * What a space is called in one locale: a community's own name ("Community"
 * when it has none), or the published title of the course or programme it
 * belongs to. Payload falls back to the default locale for an empty one.
 */
const nameOf = async (req: PayloadRequest, space: SpaceRow, locale: TypedLocale) => {
  if (space.kind === 'community') return space.name?.trim() || 'Community'
  const parent = space.kind === 'cohort' ? 'programmes' : 'courses'
  const missing = space.kind === 'cohort' ? 'Programme deleted' : 'Course deleted'
  const id = relId((space.kind === 'cohort' ? space.programme : space.course) as never)
  if (id == null) return missing
  // A parent that is gone reads as null; any other failure fails the save.
  const doc = await req.payload.findByID({
    collection: parent,
    id,
    depth: 0,
    locale,
    draft: false,
    disableErrors: true,
    overrideAccess: true,
    req,
    select: { title: true },
  })
  return doc?.title?.trim() || missing
}

/**
 * Stores the space's `display_name` in every locale: the title the admin shows
 * for a space everywhere (lists, relationship fields, filters). The spaces
 * collection calls it after each save, and a course or programme after each
 * publish, so the name follows a rename. Returns the name in each locale.
 */
export const refreshSpaceName = async (
  req: PayloadRequest,
  id: number,
): Promise<Partial<Record<TypedLocale, string>>> => {
  // Each local-API call below sets its locale and fallback on the shared
  // request: put back the caller's, so the rest of its save reads as before.
  const { locale, fallbackLocale } = req
  try {
    return await refreshEachLocale(req, id)
  } finally {
    req.locale = locale
    req.fallbackLocale = fallbackLocale
  }
}

const refreshEachLocale = async (
  req: PayloadRequest,
  id: number,
): Promise<Partial<Record<TypedLocale, string>>> => {
  const { payload } = req
  const { localization } = payload.config
  if (!localization) return {}
  const locales = localization.localeCodes as TypedLocale[]
  const defaultLocale = localization.defaultLocale as TypedLocale
  const names: Partial<Record<TypedLocale, string>> = {}
  for (const locale of locales) {
    // The name comes from a read with fallback (an Arabic space without an
    // Arabic name is called by its English one); the comparison is with the
    // value stored in this locale, which that fallback would hide. One read
    // after the other, each with its own fallback: the local API sets it on
    // the shared request.
    const read = (fallbackLocale: TypedLocale | false) =>
      payload.findByID({
        collection: 'spaces',
        id,
        depth: 0,
        locale,
        fallbackLocale,
        overrideAccess: true,
        req,
        select: { kind: true, name: true, course: true, programme: true, display_name: true },
      }) as Promise<SpaceRow>
    const space = await read(defaultLocale)
    const stored = await read(false)
    const name = await nameOf(req, space, locale)
    names[locale] = name
    if (name === stored.display_name) continue
    req.context[WRITING] = true
    try {
      await payload.update({
        collection: 'spaces',
        id,
        locale,
        data: { display_name: name } as never,
        overrideAccess: true,
        req,
      })
    } finally {
      delete req.context[WRITING]
    }
  }
  return names
}

/**
 * The spaces collection's afterChange: a new space or a renamed community
 * gets its name, and the save returns it in the request's locale.
 */
export const refreshOwnName: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (req.context[WRITING]) return doc
  const { localization } = req.payload.config
  const locale = (req.locale ??
    (localization ? localization.defaultLocale : undefined)) as TypedLocale
  const names = await refreshSpaceName(req, doc.id)
  return locale in names ? { ...doc, display_name: names[locale] } : doc
}

/** A course's or programme's afterChange: a published title change reaches its space. */
export const refreshOwnedSpaceNames =
  (field: 'course' | 'programme'): CollectionAfterChangeHook<Course | Programme> =>
  async ({ doc, req }) => {
    if (doc._status !== 'published') return doc
    const { docs } = await req.payload.find({
      collection: 'spaces',
      where: { [field]: { equals: doc.id } },
      depth: 0,
      pagination: false,
      overrideAccess: true,
      req,
      select: { kind: true },
    })
    for (const space of docs) await refreshSpaceName(req, space.id)
    return doc
  }
