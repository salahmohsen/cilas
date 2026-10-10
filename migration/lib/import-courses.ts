import type { CollectionSlug, Payload, Where } from 'payload'

import { slugify } from '../../src/lib/slugify'
import { lexical } from '../../seed/seed.utils'
import { isMostlyArabic, splitLocales } from './normalise-courses'

export type ArchiveCycle = {
  key: string
  season: 'fall' | 'winter' | 'spring' | 'summer'
  start_year: number
  start_date?: string
  deadline?: string
  space: string
  legacy_url: string
}

export type ArchiveCourse = {
  legacy_url: string
  cycle: string | null
  title: string
  title_ar: string | null
  subtitle: string | null
  course_type: 'CORE' | 'THEMATIC' | 'LAB' | 'WORKSHOP' | 'SHORT'
  fellows: Array<{ name: string; email: string | null; bio: string | null }>
  location: Array<'OFFLINE' | 'ONLINE' | 'HYBRID'>
  schedule: {
    start_date?: string
    start_precision: 'day' | 'week'
    weeks?: number
    slots: Array<{ weekday: 'sat' | 'sun' | 'mon' | 'tue' | 'wed' | 'thu' | 'fri'; start_time: string; end_time: string }>
    note?: string
  }
  description: string
  flow_uploads: string[]
  register_url: string | null
}

const paragraphs = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
const rich = (text: string) =>
  text.trim() ? lexical(paragraphs(text), isMostlyArabic(text) ? 'rtl' : 'ltr') : null

/**
 * Creates the document, or updates it when the import made it and nobody has
 * reviewed it since. Reviewed documents are never touched again.
 *
 * `fallbackSlug` is for a create only: when the slug's unique index rejects
 * the first attempt (two archived courses with one title), it is tried once.
 * An update keeps the slug the document already has.
 */
const upsert = async (
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  data: Record<string, unknown>,
  options: { draft?: boolean; fallbackSlug?: string } = {},
): Promise<number> => {
  const { docs } = await payload.find({ collection, where, limit: 1, depth: 0, overrideAccess: true, draft: options.draft })
  const existing = docs[0] as { id: number; import_status?: string | null } | undefined
  if (existing?.import_status === 'reviewed') return existing.id
  if (existing) {
    const { slug: _keep, ...rest } = data
    await payload.update({ collection, id: existing.id, data: options.fallbackSlug ? rest : data, overrideAccess: true, draft: options.draft } as Parameters<Payload['update']>[0])
    return existing.id
  }
  const create = (body: Record<string, unknown>) =>
    payload.create({ collection, data: body, overrideAccess: true, draft: options.draft } as Parameters<Payload['create']>[0])
  try {
    return (await create(data)).id as number
  } catch (error) {
    if (!options.fallbackSlug) throw error
    return (await create({ ...data, slug: options.fallbackSlug })).id as number
  }
}

/** Imports archived cycles and courses as drafts marked "needs review". */
export const importCourses = async (
  payload: Payload,
  { cycles, courses }: { cycles: ArchiveCycle[]; courses: ArchiveCourse[] },
): Promise<{ cycles: number; courses: number; people: number; skipped: string[] }> => {
  const spaces = new Map<string, number>()
  for (const name of new Set(cycles.map((c) => c.space))) {
    spaces.set(
      name,
      await upsert(payload, 'spaces', { name: { equals: name } }, { name, slug: slugify(name) }),
    )
  }

  const cycleIds = new Map<string, number>()
  const cycleYears = new Map<string, number>()
  for (const c of cycles) {
    cycleYears.set(c.key, c.start_year)
    cycleIds.set(
      c.key,
      // One cycle per season, year and space (unique index), so match an
      // existing one, e.g. from the dev seed, as well as an earlier import.
      await upsert(payload, 'cycles', {
        or: [
          { legacy_url: { equals: c.legacy_url } },
          {
            and: [
              { season: { equals: c.season } },
              { start_year: { equals: c.start_year } },
              { space: { equals: spaces.get(c.space) } },
            ],
          },
        ],
      }, {
        season: c.season,
        start_year: c.start_year,
        space: spaces.get(c.space),
        ...(c.start_date ? { start_date: c.start_date } : {}),
        ...(c.deadline ? { registration: { deadline: c.deadline } } : {}),
        legacy_url: c.legacy_url,
        import_status: 'needs_review',
      }),
    )
  }

  const people = new Map<string, number>()
  let newPeople = 0
  const personFor = async (f: ArchiveCourse['fellows'][number], from: string): Promise<number> => {
    const known = people.get(f.name)
    if (known) return known
    const { docs } = await payload.find({ collection: 'people', where: { name: { equals: f.name } }, limit: 1, depth: 0, overrideAccess: true })
    let id = docs[0]?.id
    if (!id) {
      id = (
        await payload.create({
          collection: 'people',
          data: {
            name: f.name,
            slug: slugify(f.name),
            ...(f.bio ? { bio: rich(f.bio) } : {}),
            legacy_url: `${from}#${slugify(f.name)}`,
            import_status: 'needs_review',
          },
          overrideAccess: true,
        })
      ).id
      newPeople++
    }
    people.set(f.name, id)
    return id
  }

  const skipped: string[] = []
  let imported = 0
  for (const c of courses) {
    const cycle = c.cycle ? cycleIds.get(c.cycle) : undefined
    if (!cycle) {
      skipped.push(c.legacy_url)
      continue
    }
    const fellows = []
    for (const f of c.fellows) fellows.push(await personFor(f, c.legacy_url.split('#')[0]))
    const slug = slugify(c.title) || slugify(c.legacy_url)
    const id = await upsert(
      payload,
      'courses',
      { legacy_url: { equals: c.legacy_url } },
      {
        title: c.title,
        slug,
        subtitle: c.subtitle,
        course_type: c.course_type,
        cycle,
        tier: 'public',
        session_unit: 'session',
        location: c.location,
        fellows,
        schedule: c.schedule,
        // English paragraphs here; Arabic ones go to the `ar` locale below.
        description: rich(splitLocales(c.description).en),
        ...(c.register_url ? { registration: { archived_registration_url: c.register_url } } : {}),
        legacy_url: c.legacy_url,
        import_status: 'needs_review',
        _status: 'draft',
      },
      { draft: true, fallbackSlug: `${slug}-${cycleYears.get(c.cycle as string)}` },
    )
    // The Arabic locale: an Arabic title (given, or the title itself when it
    // is Arabic) and the description's Arabic paragraphs.
    const titleAr = c.title_ar ?? (isMostlyArabic(c.title) ? c.title : null)
    const descriptionAr = splitLocales(c.description).ar
    if (titleAr || descriptionAr) {
      const current = (await payload.findByID({ collection: 'courses', id, depth: 0, draft: true, overrideAccess: true })) as {
        import_status?: string | null
      }
      if (current.import_status !== 'reviewed') {
        await payload.update({
          collection: 'courses',
          id,
          data: {
            ...(titleAr ? { title: titleAr } : {}),
            ...(descriptionAr ? { description: rich(descriptionAr) } : {}),
          },
          locale: 'ar',
          draft: true,
          overrideAccess: true,
        })
      }
    }
    imported++
  }

  return { cycles: cycleIds.size, courses: imported, people: newPeople, skipped }
}
