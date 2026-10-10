import type { CollectionSlug, Payload, Where } from 'payload'
import { weekdayOf } from '@/lib/cairo-day'
import type {
  IdMap,
  LexicalChild,
  LexicalJSON,
  MaterialSeed,
  MaterialType,
  ScheduleSeed,
  SessionSeed,
  UserSeed,
} from './seed.type'

export const DEFAULT_PASSWORD = '03e8a7b597945379eda7388a'

/**
 * Wiped on every run, in this order. `users` is deliberately absent — accounts
 * survive, and seedUsers restores their `person` link. `people` goes last:
 * governance and memberships require a person.
 */
export const CONTENT_COLLECTIONS: CollectionSlug[] = [
  'courses',
  'cycles',
  'programmes',
  'governance',
  'article-collections',
  'articles',
  'press',
  'events',
  'spaces',
  'memberships',
  'people',
]

/* ================================================================= lexical */

const paragraph = (text: string, direction: 'ltr' | 'rtl'): LexicalChild => ({
  type: 'paragraph',
  format: '',
  indent: 0,
  version: 1,
  direction,
  textFormat: '',
  textStyle: '',
  children: [{ type: 'text', detail: 0, format: 0, mode: 'normal', style: '', text, version: 1 }],
})

/**
 * Lexical document. A string becomes a single paragraph; an array becomes one
 * paragraph per entry, which is what long-form article bodies need. Pass
 * `'rtl'` for Arabic so Lexical stores the correct text direction.
 */
export const lexical = (
  content: string | string[],
  direction: 'ltr' | 'rtl' = 'ltr',
): LexicalJSON => {
  const blocks = Array.isArray(content) ? content : [content]

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
      direction,
      children: blocks.map((text) => paragraph(text, direction)),
    },
  }
}

/* =============================================================== materials */

export const material = (
  type: MaterialType,
  title: string,
  note?: string,
  href?: string,
): MaterialSeed => ({ type, title, note: note ?? null, href: href ?? null })

export const reading = (title: string, note?: string, href?: string): MaterialSeed =>
  material('reading', title, note, href)

export const watch = (title: string, note?: string, href?: string): MaterialSeed =>
  material('watch', title, note, href)

export const listen = (title: string, note?: string, href?: string): MaterialSeed =>
  material('listen', title, note, href)

export const prompt = (title: string, note?: string, href?: string): MaterialSeed =>
  material('prompt', title, note, href)

export const link = (title: string, href: string, note?: string): MaterialSeed =>
  material('other', title, note, href)

/* ================================================================ courses */
/**
 * A course that meets once a week from `firstDate`, one session per week. The
 * schedule is the pattern; dates come from `expandSchedule()` (ADR 0002).
 */
export const weekly = (
  firstDate: string,
  start: string,
  end: string,
  sessions: SessionSeed[],
): { schedule: ScheduleSeed; sessions: SessionSeed[] } => ({
  schedule: {
    start_date: firstDate,
    weeks: sessions.length,
    slots: [{ weekday: weekdayOf(firstDate), start_time: start, end_time: end }],
  },
  sessions,
})

/* ================================================== bibliography (shared) */

/**
 * Course- or session-level bibliography entry, mirroring the schema's
 * reading/watch/listen/prompt/other select.
 */
export const bib = ({ type, title, note, href }: MaterialSeed) =>
  ({ type, title, note, href })

/* ================================================================== upsert */

export const findId = async (
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
): Promise<number | null> => {
  const existing = await payload.find({
    collection,
    where,
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const first = existing.docs[0]
  return first ? Number(first.id) : null
}

/**
 * Idempotent create. The `create` closure keeps the literal collection slug, so
 * `data` stays fully type-checked against the generated collection types.
 */
export const getOrCreateId = async (
  payload: Payload,
  collection: CollectionSlug,
  where: Where,
  create: () => Promise<{ id: number | string }>,
): Promise<number> => {
  const existing = await findId(payload, collection, where)
  if (existing !== null) return existing
  const doc = await create()
  return Number(doc.id)
}

/**
 * Create-only. An existing account is returned untouched, so the password of a
 * real account is never reset. Callers that want the seeded content refreshed
 * on every run must issue their own `update` — see `seedUsers`.
 */
export const getOrCreateUser = async (payload: Payload, user: UserSeed): Promise<number> => {
  const { email, roles, password } = user
  return getOrCreateId(payload, 'users', { email: { equals: email } }, () =>
    payload.create({
      collection: 'users',
      data: { email, password: password ?? DEFAULT_PASSWORD, roles },
      overrideAccess: true,
    }),
  )
}

/* ================================================================= context */

export const requireId = (map: IdMap, key: string): number => {
  const id = map[key]
  if (id === undefined) {
    throw new Error(`seed: no id for "${key}" — seed the parent collection first`)
  }
  return id
}

export const requireIds = (map: IdMap, keys: string[]): number[] =>
  keys.map((key) => requireId(map, key))

/* ================================================================== reset */

export const resetContent = async (payload: Payload): Promise<void> => {
  for (const collection of CONTENT_COLLECTIONS) {
    await payload.db.deleteMany({ collection, where: {} })
    console.log(`cleared ${collection}`)
  }
}
