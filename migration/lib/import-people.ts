import type { CollectionSlug, Payload, Where } from 'payload'

import { slugify } from '../../src/lib/slugify'
import { writeBio } from './people-bio'
import { freeSlug, upsert } from './import-courses'

export type ArchivePerson = {
  name: string
  name_ar: string | null
  bio: string | null
  email: string | null
  /** Upload path on the old site, kept for plan 6.5; nothing is uploaded here. */
  photo: string | null
  legacy_url: string
}

export type ArchiveProgramme = {
  title: string
  /** As written, e.g. "2015–2016"; a hyphen is read as an en dash. */
  year: string
  place: 'cairo' | 'alexandria'
  verified: boolean
  legacy_url: string | null
}

export type ArchiveMembership = {
  person: string
  programme: string
  role: 'student' | 'residential_fellow' | 'visiting_fellow'
  title: string | null
  legacy_url: string
}

export type ArchiveGovernance = {
  person: string
  role: 'advisor' | 'trustee'
  title: string | null
  advises_on: string | null
  board_role: string | null
  order: number
  legacy_url: string
}

export type ArchivePeopleData = {
  people: ArchivePerson[]
  programmes: ArchiveProgramme[]
  memberships: ArchiveMembership[]
  governance: ArchiveGovernance[]
}

/** The spaces whose cycles belong to a programme in each city. */
export const SPACES_BY_PLACE: Record<ArchiveProgramme['place'], string[]> = {
  cairo: ['al-Ghuria', 'Darb el-Labbana'],
  alexandria: ['al-Manshiya'],
}

export const UNVERIFIED_NOTE = 'Unverified year: no cohort page in the archive'


const SEASON_MONTH: Record<string, number> = { fall: 9, winter: 1, spring: 3, summer: 6 }

type CycleRow = { id: number; title?: string | null; season: string; start_year: number; start_date?: string | null }
const cycleOrder = (c: CycleRow): string =>
  c.start_date ?? `${c.start_year}-${String(SEASON_MONTH[c.season] ?? 1).padStart(2, '0')}-01`

const count = async (payload: Payload, collection: CollectionSlug): Promise<number> =>
  (await payload.count({ collection, overrideAccess: true })).totalDocs

/**
 * Imports the archive's people, Bridge programmes, memberships and governance.
 * Everything new is marked "needs review"; reviewed and hand-made documents
 * are never overwritten. Returns how many of each were created.
 */
export const importPeople = async (
  payload: Payload,
  data: ArchivePeopleData,
): Promise<{ people: number; programmes: number; memberships: number; governance: number }> => {
  // 1. People: found by exact name in the default locale, else created.
  const personIds = new Map<string, number>()
  let newPeople = 0
  for (const p of data.people) {
    const { docs } = await payload.find({
      collection: 'people',
      where: { name: { equals: p.name } },
      limit: 1,
      depth: 0,
      locale: 'en',
      overrideAccess: true,
    })
    const existing = docs[0] as { id: number; bio?: unknown; import_status?: string | null } | undefined
    let id: number
    if (!existing) {
      const legacyTaken =
        (await payload.count({ collection: 'people', where: { legacy_url: { equals: p.legacy_url } }, overrideAccess: true }))
          .totalDocs > 0
      id = (
        await payload.create({
          collection: 'people',
          data: {
            name: p.name,
            slug: await freeSlug(payload, 'people', slugify(p.name)),
            ...(legacyTaken ? {} : { legacy_url: p.legacy_url }),
            import_status: 'needs_review',
          },
          locale: 'en',
          overrideAccess: true,
        })
      ).id as number
      if (p.bio?.trim()) await writeBio(payload, id, { name: p.name, nameAr: p.name_ar, bio: p.bio })
      newPeople++
    } else {
      id = existing.id
      // An imported person nobody has reviewed: fill in what is empty, never overwrite.
      if (existing.import_status === 'needs_review' && !existing.bio && p.bio?.trim()) {
        await writeBio(payload, id, { name: p.name, nameAr: p.name_ar, bio: p.bio })
      }
    }
    if (p.name_ar && (!existing || existing.import_status === 'needs_review')) {
      const ar = (await payload.findByID({
        collection: 'people',
        id,
        depth: 0,
        locale: 'ar',
        fallbackLocale: false,
        overrideAccess: true,
      })) as { name?: string | null }
      if (!ar.name) {
        await payload.update({ collection: 'people', id, data: { name: p.name_ar }, locale: 'ar', overrideAccess: true })
      }
    }
    personIds.set(p.name, id)
  }

  const personId = async (name: string): Promise<number> => {
    const known = personIds.get(name)
    if (known) return known
    const { docs } = await payload.find({
      collection: 'people',
      where: { name: { equals: name } },
      limit: 1,
      depth: 0,
      locale: 'en',
      overrideAccess: true,
    })
    if (!docs[0]) throw new Error(`No person named "${name}"`)
    personIds.set(name, docs[0].id as number)
    return docs[0].id as number
  }

  // 2. Programmes, as drafts, with the cycles of their year and city.
  const spaceIds = new Map<string, number>()
  for (const name of new Set(Object.values(SPACES_BY_PLACE).flat())) {
    const { docs } = await payload.find({ collection: 'spaces', where: { name: { equals: name } }, limit: 1, depth: 0, overrideAccess: true })
    if (docs[0]) spaceIds.set(name, docs[0].id as number)
  }
  const programmesBefore = await count(payload, 'programmes')
  const programmeIds = new Map<string, number>()
  for (const pr of data.programmes) {
    const year = pr.year.replace('-', '–')
    const spaces = SPACES_BY_PLACE[pr.place].map((s) => spaceIds.get(s)).filter((s): s is number => s !== undefined)
    const { docs } = spaces.length
      ? await payload.find({
          collection: 'cycles',
          where: { and: [{ academic_year: { equals: year } }, { space: { in: spaces } }] },
          pagination: false,
          depth: 0,
          overrideAccess: true,
        })
      : { docs: [] }
    const cycles = (docs as unknown as CycleRow[]).sort((a, b) => cycleOrder(a).localeCompare(cycleOrder(b)))
    const slug = slugify(pr.title)
    const id = await upsert(
      payload,
      'programmes',
      { title: { equals: pr.title } },
      {
        title: pr.title,
        slug,
        kind: 'bridge',
        cycles: cycles.map((c) => c.id),
        components: pr.verified
          ? cycles.flatMap((c) => [
              { label: `Core courses, ${c.title}`, cycle: c.id, course_types: ['CORE'] },
              { label: `Thematic courses and labs, ${c.title}`, cycle: c.id, course_types: ['THEMATIC', 'LAB'] },
            ])
          : [],
        schedule_note: pr.verified ? null : UNVERIFIED_NOTE,
        legacy_url: pr.legacy_url,
        import_status: 'needs_review',
        _status: 'draft',
      },
      // Passing the slug as its own fallback keeps it out of updates.
      { draft: true, fallbackSlug: slug },
    )
    programmeIds.set(pr.title, id)
  }
  const programmesCreated = (await count(payload, 'programmes')) - programmesBefore

  // 3. Memberships: one per person and programme (the unique index).
  const membershipsBefore = await count(payload, 'memberships')
  for (const m of data.memberships) {
    const programme = programmeIds.get(m.programme)
    if (!programme) throw new Error(`No programme "${m.programme}" for ${m.person}`)
    const person = await personId(m.person)
    await upsert(
      payload,
      'memberships',
      { and: [{ person: { equals: person } }, { programme: { equals: programme } }] },
      { person, programme, role: m.role, title: m.title, legacy_url: m.legacy_url, import_status: 'needs_review' },
    )
  }
  const membershipsCreated = (await count(payload, 'memberships')) - membershipsBefore

  // 4. Governance: one row per person and role.
  const governanceBefore = await count(payload, 'governance')
  for (const g of data.governance) {
    const person = await personId(g.person)
    await upsert(
      payload,
      'governance',
      { and: [{ person: { equals: person } }, { role: { equals: g.role } }] },
      {
        person,
        role: g.role,
        title: g.title,
        advises_on: g.role === 'advisor' ? g.advises_on : null,
        board_role: g.role === 'trustee' ? g.board_role : null,
        order: g.order,
        legacy_url: g.legacy_url,
        import_status: 'needs_review',
      },
    )
  }
  const governanceCreated = (await count(payload, 'governance')) - governanceBefore

  return { people: newPeople, programmes: programmesCreated, memberships: membershipsCreated, governance: governanceCreated }
}

/** More than this many deletions in one prune almost certainly means a bug. */
export const PRUNE_LIMIT = 200

type Rel = number | { id: number } | null | undefined
const idOf = (r: Rel): number | null => (r == null ? null : typeof r === 'object' ? r.id : r)

/** Every person any document points at, published or latest draft. */
export const referencedPeople = async (payload: Payload): Promise<Set<number>> => {
  const ids = new Set<number>()
  const add = (r: Rel) => {
    const id = idOf(r)
    if (id !== null) ids.add(id)
  }
  const all = async (collection: CollectionSlug, draft: boolean, where?: Where) =>
    (await payload.find({ collection, where, pagination: false, depth: 0, overrideAccess: true, draft })).docs as unknown as Array<
      Record<string, unknown>
    >
  // Collections with drafts are read twice: the published documents and the
  // latest versions. A never-published draft's main row is not read: draft
  // saves leave it stale (it can still list a fellow the draft has replaced).
  const both = async (collection: CollectionSlug) => [
    ...(await all(collection, false, { _status: { equals: 'published' } })),
    ...(await all(collection, true)),
  ]

  for (const c of await both('courses')) for (const f of (c.fellows as Rel[] | null) ?? []) add(f)
  for (const m of await all('memberships', false)) add(m.person as Rel)
  for (const g of await all('governance', false)) add(g.person as Rel)
  for (const e of await all('enrollments', false)) add(e.person as Rel)
  for (const a of await both('articles')) {
    for (const p of (a.authors as Rel[] | null) ?? []) add(p)
    for (const credit of (a.credits as Array<{ people?: Rel[] }> | null) ?? []) for (const p of credit.people ?? []) add(p)
    for (const p of ((a.translation as { original_authors?: Rel[] } | null)?.original_authors ?? [])) add(p)
  }
  for (const p of await all('publications', false))
    for (const credit of (p.credits as Array<{ people?: Rel[] }> | null) ?? []) for (const x of credit.people ?? []) add(x)
  for (const e of await all('events', false)) for (const s of (e.speakers as Array<{ person?: Rel }> | null) ?? []) add(s.person)
  for (const p of await both('programmes'))
    for (const t of (p.testimonials as Array<{ person?: Rel }> | null) ?? []) add(t.person)
  for (const p of await all('press', false)) for (const a of (p.authors as Array<{ person?: Rel }> | null) ?? []) add(a.person)
  for (const u of await all('users', false)) add(u.person as Rel)
  return ids
}

/**
 * Deletes imported people still marked "needs review" that nothing points at,
 * e.g. a name variant whose courses now point at the canonical person.
 * Reviewed and hand-made people are never candidates. Returns the names.
 */
export const prunePeople = async (
  payload: Payload,
  { limit = PRUNE_LIMIT, scope }: { limit?: number; /** Narrows the candidates, e.g. to test fixtures. */ scope?: Where } = {},
): Promise<string[]> => {
  const referenced = await referencedPeople(payload)
  const needsReview: Where = { import_status: { equals: 'needs_review' } }
  const { docs } = await payload.find({
    collection: 'people',
    where: scope ? { and: [needsReview, scope] } : needsReview,
    pagination: false,
    depth: 0,
    locale: 'en',
    overrideAccess: true,
  })
  const doomed = (docs as Array<{ id: number; name: string; import_status?: string | null }>).filter(
    (p) => p.import_status === 'needs_review' && !referenced.has(p.id),
  )
  if (doomed.length > limit) {
    throw new Error(`Prune would delete ${doomed.length} people (limit ${limit}); refusing, this is likely a bug.`)
  }
  const pruned: string[] = []
  for (const p of doomed) {
    await payload.delete({ collection: 'people', id: p.id, overrideAccess: true })
    pruned.push(p.name)
  }
  return pruned
}
