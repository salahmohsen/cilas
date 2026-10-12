import type { CollectionSlug, Payload, Where } from 'payload'

import { writeBio } from './people-bio'
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
  /** From migration/course-overrides.json. */
  epigraph?: string
  epigraph_ar?: string
  flow_uploads: string[]
  register_url: string | null
}

const paragraphs = (text: string): string[] => text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
const rich = (text: string) =>
  text.trim() ? lexical(paragraphs(text), isMostlyArabic(text) ? 'rtl' : 'ltr') : null

const isFree = async (payload: Payload, collection: CollectionSlug, slug: string): Promise<boolean> =>
  (await payload.count({ collection, where: { slug: { equals: slug } }, overrideAccess: true })).totalDocs === 0

/** `base`, or `base-2`, `base-3`… — the first slug no document in `collection` uses. */
export const freeSlug = async (payload: Payload, collection: CollectionSlug, base: string): Promise<string> => {
  const { docs } = await payload.find({
    collection,
    where: { slug: { like: base } },
    limit: 1000,
    depth: 0,
    select: { slug: true },
    overrideAccess: true,
    draft: true,
  })
  const taken = new Set(docs.map((d) => (d as { slug?: string }).slug))
  if (!taken.has(base)) return base
  for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`
}

/**
 * Creates the document, or updates it when the import made it and nobody has
 * reviewed it since. Reviewed documents are never touched again.
 *
 * `fallbackSlug` is for a create only: when the slug is taken (two archived
 * courses with one title), it is used instead, numbered further if needed.
 * An update keeps the slug the document already has.
 */
export const upsert = async (
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
  // A taken slug falls back to `fallbackSlug` (the title plus its year), then
  // to the first free numbered variant of whichever was chosen.
  let body = data
  if (typeof data.slug === 'string') {
    const preferred =
      options.fallbackSlug && !(await isFree(payload, collection, data.slug)) ? options.fallbackSlug : data.slug
    body = { ...data, slug: await freeSlug(payload, collection, preferred) }
  }
  const doc = await payload.create({ collection, data: body, overrideAccess: true, draft: options.draft } as Parameters<Payload['create']>[0])
  return doc.id as number
}

/**
 * Publishes a course's latest draft, both languages. It runs in the default
 * locale: publishing validates the request's locale, and a course need not
 * have an Arabic title. Reviewed courses are left as their reviewer left them.
 */
export const publishCourse = async (payload: Payload, id: number): Promise<void> => {
  const current = (await payload.findByID({ collection: 'courses', id, depth: 0, draft: true, overrideAccess: true })) as {
    import_status?: string | null
  }
  if (current.import_status === 'reviewed') return
  await payload.update({ collection: 'courses', id, data: { _status: 'published' }, overrideAccess: true })
}

/** Imports archived cycles and courses: written as drafts, then published, marked "needs review". */
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
      // A variant spelling with the same slug (e.g. "Alaa el-Bannan" for
      // "Alaa El-Bannan") may hold this legacy URL already: it is unique.
      const legacy_url = `${from}#${slugify(f.name)}`
      const legacyTaken =
        (await payload.count({ collection: 'people', where: { legacy_url: { equals: legacy_url } }, overrideAccess: true }))
          .totalDocs > 0
      id = (
        await payload.create({
          collection: 'people',
          data: {
            name: f.name,
            slug: await freeSlug(payload, 'people', slugify(f.name)),
            ...(legacyTaken ? {} : { legacy_url }),
            import_status: 'needs_review',
          },
          overrideAccess: true,
        })
      ).id
      if (f.bio) await writeBio(payload, id, { name: f.name, bio: f.bio })
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
        ...(c.epigraph ? { epigraph: c.epigraph } : {}),
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
    if (titleAr || descriptionAr || c.epigraph_ar) {
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
            ...(c.epigraph_ar ? { epigraph: c.epigraph_ar } : {}),
          },
          locale: 'ar',
          draft: true,
          overrideAccess: true,
        })
      }
    }
    await publishCourse(payload, id)
    imported++
  }

  return { cycles: cycleIds.size, courses: imported, people: newPeople, skipped }
}
