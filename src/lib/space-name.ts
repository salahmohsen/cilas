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
  const doc = await req.payload
    .findByID({
      collection: parent,
      id,
      depth: 0,
      locale,
      draft: false,
      overrideAccess: true,
      req,
      select: { title: true },
    })
    .catch(() => null)
  return doc?.title?.trim() || missing
}

/**
 * Stores the space's `display_name` in every locale: the title the admin shows
 * for a space everywhere (lists, relationship fields, filters). The spaces
 * collection calls it after each save, and a course or programme after each
 * publish, so the name follows a rename.
 */
export const refreshSpaceName = async (req: PayloadRequest, id: number): Promise<void> => {
  const { payload } = req
  const locales = (payload.config.localization || undefined)?.localeCodes ?? []
  for (const locale of locales as TypedLocale[]) {
    const space = (await payload.findByID({
      collection: 'spaces',
      id,
      depth: 0,
      locale,
      overrideAccess: true,
      req,
      select: { kind: true, name: true, course: true, programme: true, display_name: true },
    })) as SpaceRow
    const name = await nameOf(req, space, locale)
    if (name === space.display_name) continue
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
}

/** The spaces collection's afterChange: a new space or a renamed community gets its name. */
export const refreshOwnName: CollectionAfterChangeHook = async ({ doc, req }) => {
  if (!req.context[WRITING]) await refreshSpaceName(req, doc.id)
  return doc
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
