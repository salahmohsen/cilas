/**
 * Plan 6.7: write reviewed corrections into the courses.
 *
 *   npx tsx --env-file=.env migration/apply-reviews.ts migration/raw [--dry] [id...]
 *
 * Reads migration/extracted/reviews/<id>.json (CourseReview), checked against
 * the course's source pages and flow. Per course, in order:
 *   1. a syllabus from the source replaces its sessions and bibliography,
 *      written as a page flow (so the description loses what moved there);
 *   2. the fields in `set`, each language in its own locale;
 *   3. a cover from the source page, when the course has none.
 * Reviewed courses are never touched. Writes migration/review/corrections.md.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { getPayload, type Payload, type Where } from 'payload'

import { lexical } from '../seed/seed.utils'
import { importFlows } from './lib/import-flows'
import { slugify } from '../src/lib/slugify'
import { freeSlug, publishCourse, upsert } from './lib/import-courses'
import { mediaFor } from './lib/import-media'
import { CourseReview, NewCourse } from './lib/review-schema'
import { resolveUpload } from './lib/uploads'

const args = process.argv.slice(2)
const raw = args[0]
if (!raw || raw.startsWith('--'))
  throw new Error(
    'Usage: npx tsx --env-file=.env migration/apply-reviews.ts <raw dir> [--dry] [id...]',
  )
const dry = args.includes('--dry')
const only = new Set(
  args
    .slice(1)
    .filter((a) => /^\d+$/.test(a))
    .map(Number),
)

const here = import.meta.dirname
const dir = path.join(here, 'extracted', 'reviews')
const reviews = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .map((f) => CourseReview.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8'))))
  .filter((r) => !only.size || only.has(r.id))
  .sort((a, b) => a.id - b.id)

const zip = path.join(raw, 'weebly-zip-2025-04-23')
const mirror = path.join(raw, 'mirror')
const listFiles = (root: string, rel = ''): string[] =>
  existsSync(root)
    ? readdirSync(root, { withFileTypes: true }).flatMap((e) => {
        const relPath = rel ? `${rel}/${e.name}` : e.name
        return e.isDirectory() ? listFiles(path.join(root, e.name), relPath) : [relPath]
      })
    : []
const zipFiles = new Set(listFiles(path.join(zip, 'uploads'), 'uploads'))
const allFiles = new Set([...zipFiles, ...listFiles(path.join(mirror, 'uploads'), 'uploads')])

type Locale = 'en' | 'ar'
const LOCALIZED = [
  'subtitle',
  'summary',
  'epigraph',
  'facilitator_note',
  'content_warning',
  'language_note',
] as const
const paragraphs = (text: string): string[] =>
  text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean)
const rich = (text: string | null, locale: Locale) =>
  text && paragraphs(text).length
    ? lexical(paragraphs(text), locale === 'ar' ? 'rtl' : 'ltr')
    : null

type Stored = {
  id: number
  legacy_url?: string | null
  cover_image?: number | null
  schedule?: Record<string, unknown> | null
}

/** The `set` fields for one locale, as Payload data. */
const dataFor = (set: CourseReview['set'], locale: Locale, schedule: Record<string, unknown>) => {
  const data: Record<string, unknown> = {}
  if (set.title) {
    if (locale === 'en') data.title = set.title.en
    else if (set.title.ar) data.title = set.title.ar
  }
  for (const field of LOCALIZED) {
    const value = set[field]
    if (value) data[field] = value[locale]
  }
  if (set.description) data.description = rich(set.description[locale], locale)
  if (set.schedule) {
    const { note, ...pattern } = set.schedule
    data.schedule = {
      ...schedule,
      ...(locale === 'en' ? pattern : {}),
      ...(note ? { note: note[locale] } : {}),
    }
  }
  if (locale === 'en') {
    if (set.course_type) data.course_type = set.course_type
    if (set.location) data.location = set.location
    if (set.teaching_languages) data.teaching_languages = set.teaching_languages
  }
  return data
}

const apply = async (payload: Payload, review: CourseReview, log: string[]) => {
  const find = (locale: Locale) =>
    payload.findByID({
      collection: 'courses',
      id: review.id,
      depth: 0,
      draft: true,
      locale,
      fallbackLocale: false,
      overrideAccess: true,
    }) as unknown as Promise<Stored>
  const course = await find('en').catch(() => null)
  if (!course) return log.push(`- ${review.id}: no such course`)
  const head = `### ${review.id} ${course.legacy_url ?? ''}`
  log.push(head, ...review.notes.map((n) => `- ${n}`))
  if (dry) return

  if (review.syllabus && course.legacy_url) {
    // importFlows sets facilitator_note from the syllabus notes (null here):
    // keep the course's own unless the review sets it.
    const before = (await payload.findByID({
      collection: 'courses',
      id: review.id,
      depth: 0,
      draft: true,
      locale: 'all',
      overrideAccess: true,
    })) as unknown as {
      facilitator_note?: Partial<Record<Locale, string | null>> | null
    }
    const id = `page-review-${review.id}`
    await importFlows(payload, {
      flows: [{ id, courses: [course.legacy_url] }],
      syllabi: new Map([[id, review.syllabus]]),
      courses: [{ legacy_url: course.legacy_url, cycle: 'any' }],
    })
    if (!review.set.facilitator_note) {
      for (const locale of ['en', 'ar'] as const) {
        const note = before.facilitator_note?.[locale] ?? null
        if (note)
          await payload.update({
            collection: 'courses',
            id: review.id,
            data: { facilitator_note: note },
            locale,
            draft: true,
            overrideAccess: true,
          })
      }
    }
  }

  if (Object.keys(review.set).length) {
    for (const locale of ['en', 'ar'] as const) {
      const current = await find(locale)
      const data = dataFor(review.set, locale, (current.schedule ?? {}) as Record<string, unknown>)
      if (Object.keys(data).length) {
        await payload.update({
          collection: 'courses',
          id: review.id,
          data,
          locale,
          draft: true,
          overrideAccess: true,
        })
      }
    }
  }

  if (review.cover && !course.cover_image) {
    const r = resolveUpload(review.cover.upload, allFiles)
    if (!r || r.missing) log.push(`- cover ${review.cover.upload}: not in the archive`)
    else {
      const file = path.join(zipFiles.has(r.path) ? zip : mirror, r.path)
      const media = await mediaFor(payload, { path: r.path, file, alt: review.cover.alt })
      await payload.update({
        collection: 'courses',
        id: review.id,
        data: { cover_image: media.id },
        draft: true,
        overrideAccess: true,
      })
      log.push(`- cover: ${r.path}`)
    }
  }

  await publishCourse(payload, review.id)
}

/** Fellows' bios the import got wrong (extracted/people-fixes.json); only the locales given change. */
const applyPeople = async (payload: Payload, log: string[]) => {
  const file = path.join(here, 'extracted', 'corrections', 'people-fixes.json')
  if (!existsSync(file)) return
  const fixes = JSON.parse(readFileSync(file, 'utf8')) as Array<{
    name: string
    bio: Partial<Record<Locale, string | null>>
    $why: string
  }>
  log.push('## People')
  for (const fix of fixes) {
    const person = (
      await payload.find({
        collection: 'people',
        where: { name: { equals: fix.name } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    if (!person) {
      log.push(`- ${fix.name}: no such person`)
      continue
    }
    log.push(`### ${fix.name}`, `- ${fix.$why}`)
    if (dry) continue
    for (const locale of ['en', 'ar'] as const) {
      const bio = fix.bio[locale]
      if (bio)
        await payload.update({
          collection: 'people',
          id: person.id,
          data: { bio: rich(bio, locale) },
          locale,
          overrideAccess: true,
        })
    }
  }
}

/** Cycle corrections (extracted/cycle-reviews.json): dates, and a season or year the pages contradict. */
const applyCycles = async (payload: Payload, log: string[]) => {
  const file = path.join(here, 'extracted', 'corrections', 'cycle-reviews.json')
  if (!existsSync(file)) return
  const entries = JSON.parse(readFileSync(file, 'utf8')) as Array<{
    id: number
    set: {
      start_date?: string | null
      deadline?: string | null
      season?: string
      start_year?: number
    }
    notes: string[]
  }>
  log.push('## Cycles')
  for (const { id: oldId, set, notes } of entries) {
    const id = await cycleId(payload, oldId)
    log.push(
      `### cycle ${oldId}${id === oldId ? '' : ` (now ${id})`}`,
      ...notes.map((n) => `- ${n}`),
    )
    if (dry || id === null) continue
    const { deadline, ...rest } = set
    const current = (await payload.findByID({
      collection: 'cycles',
      id,
      depth: 0,
      overrideAccess: true,
    })) as unknown as {
      registration?: Record<string, unknown> | null
    }
    await payload.update({
      collection: 'cycles',
      id,
      overrideAccess: true,
      data: {
        ...rest,
        ...(deadline !== undefined
          ? { registration: { ...(current.registration ?? {}), deadline } }
          : {}),
      } as Record<string, unknown>,
    })
  }
}

/**
 * Courses the import missed (extracted/new-courses/*.json): each is created
 * in its cycle (made if absent), with its fellows, then handed back as a
 * review so the same steps write its text, syllabus and cover.
 */
const createNewCourses = async (payload: Payload, log: string[]): Promise<CourseReview[]> => {
  const dir = path.join(here, 'extracted', 'new-courses')
  if (!existsSync(dir)) return []
  const out: CourseReview[] = []
  log.push('## New courses')
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.json'))) {
    const c = NewCourse.parse(JSON.parse(readFileSync(path.join(dir, f), 'utf8')))
    log.push(`### new ${c.legacy_url}`, ...c.notes.map((n) => `- ${n}`))
    if (dry) continue
    const place = (
      await payload.find({
        collection: 'places',
        where: { name: { equals: c.cycle.space } },
        limit: 1,
        depth: 0,
        overrideAccess: true,
      })
    ).docs[0]
    if (!place) throw new Error(`no place ${c.cycle.space}`)
    const cycle = await upsert(
      payload,
      'cycles',
      {
        and: [
          { season: { equals: c.cycle.season } },
          { start_year: { equals: c.cycle.start_year } },
          { place: { equals: place.id } },
        ],
      },
      {
        season: c.cycle.season,
        start_year: c.cycle.start_year,
        place: place.id,
        ...(c.cycle.start_date ? { start_date: c.cycle.start_date } : {}),
      },
    )
    const fellows: number[] = []
    for (const name of c.fellows) {
      const found = (
        await payload.find({
          collection: 'people',
          where: { name: { equals: name } },
          limit: 1,
          depth: 0,
          overrideAccess: true,
        })
      ).docs[0]
      fellows.push(
        Number(
          found?.id ??
            (
              await payload.create({
                collection: 'people',
                data: {
                  name,
                  visible: true,
                  slug: await freeSlug(payload, 'people', slugify(name)),
                },
                overrideAccess: true,
              })
            ).id,
        ),
      )
    }
    const title = c.set.title as { en: string; ar: string | null }
    const id = await upsert(
      payload,
      'courses',
      { legacy_url: { equals: c.legacy_url } },
      {
        title: title.en,
        slug: await freeSlug(payload, 'courses', slugify(title.en)),
        course_type: c.set.course_type,
        cycle,
        tier: 'public',
        session_unit: c.syllabus?.session_unit ?? 'session',
        fellows,
        legacy_url: c.legacy_url,
        _status: 'draft',
      },
      { draft: true },
    )
    out.push({ id, notes: [], set: c.set, syllabus: c.syllabus, cover: c.cover, duplicate_of: [] })
  }
  return out
}

/**
 * Reviews and cycle reviews name documents by their id in the database they
 * were written against (2026-10-13); review-index.json keeps each one's
 * legacy URL (and a cycle's season and year), so they apply to a rebuilt one.
 */
const index = JSON.parse(
  readFileSync(path.join(here, 'extracted', 'corrections', 'review-index.json'), 'utf8'),
) as {
  courses: Record<string, string>
  cycles: Record<string, { legacy_url: string | null; season: string; start_year: number }>
}
const courseId = async (payload: Payload, id: number): Promise<number | null> => {
  const url = index.courses[String(id)]
  if (!url) return id
  const found = (
    await payload.find({
      collection: 'courses',
      where: { legacy_url: { equals: url } },
      limit: 1,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
  ).docs[0]
  return found ? (found.id as number) : null
}
const cycleId = async (payload: Payload, id: number): Promise<number | null> => {
  const known = index.cycles[String(id)]
  if (!known) return id
  const where: Where = known.legacy_url
    ? { legacy_url: { equals: known.legacy_url } }
    : { and: [{ season: { equals: known.season } }, { start_year: { equals: known.start_year } }] }
  const found = (
    await payload.find({ collection: 'cycles', where, limit: 1, depth: 0, overrideAccess: true })
  ).docs[0]
  return found ? (found.id as number) : null
}

const main = async () => {
  const { default: config } = await import('../src/payload.config')
  const payload = await getPayload({ config: await config })
  const log: string[] = []
  // A new course's review already holds its id in this database; mapping it
  // through review-index.json would send it to whichever course had that id.
  const created = new Set<CourseReview>()
  if (!only.size) {
    await applyCycles(payload, log)
    await applyPeople(payload, log)
    for (const review of await createNewCourses(payload, log)) {
      created.add(review)
      reviews.push(review)
    }
  }
  for (const review of reviews) {
    const id = created.has(review) ? review.id : await courseId(payload, review.id)
    if (id === null) {
      log.push(`- review ${review.id} (${index.courses[String(review.id)]}): no such course`)
      continue
    }
    review.id = id
    try {
      await apply(payload, review, log)
      console.log(`${review.id} done`)
    } catch (e) {
      log.push(`- ${review.id}: FAILED ${(e as Error).message.split('\n')[0]}`)
      console.log(`${review.id} FAILED ${(e as Error).message}`)
    }
  }
  if (!dry && !only.size) {
    writeFileSync(
      path.join(here, 'review', 'corrections.md'),
      `# Course corrections\n\nGenerated by \`apply-reviews.ts\` from \`extracted/reviews/\`. Lines starting with CHECK need a person.\n\n${log.join('\n')}\n`,
    )
  }
  console.log(`${reviews.length} review(s)${dry ? ' (dry run)' : ''}`)
  await payload.destroy()
  process.exit(0)
}

main()
