import {
  SEARCH_COLLECTIONS,
  SEARCH_LOCALES,
  localizedField,
  sortTitleField,
  type SearchCollection,
  type SearchLocale,
} from '@/lib/search-config'
import { flattenRichTextColumns } from '@/lib/flatten-rich-text-columns'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'

/**
 * Payload documents to Typesense records. Pure: the indexer reads each
 * document once per site language (no locale fallback) and hands both
 * copies here, which folds them into one bilingual record.
 */

type Doc = Record<string, unknown>

export type SearchDocument = {
  id: string
  slug: string
  updatedAt: number
  coverImage: string
  /** JSON `Contributor[]`, for the row's avatars; not searched. */
  contributors: string
  courseType?: string
  [field: string]: string | number | undefined
}

export type Contributor = { name: Partial<Record<SearchLocale, string>>; photo?: string }

const asRecord = (value: unknown): Doc | null =>
  value != null && typeof value === 'object' ? (value as Doc) : null

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])

const mediaUrl = (relation: unknown): string => {
  const url = asRecord(relation)?.url
  return typeof url === 'string' ? url : ''
}

/** Lexical nodes that sit inside a line; every other element ends one. */
const INLINE_NODES = new Set(['text', 'link', 'autolink', 'linebreak', 'inlineBlock'])

/** Lexical rich text as plain lines: inline runs join without spaces (a
 * bold word inside a sentence stays one word), blocks end with a newline. */
export const lexicalText = (richText: unknown): string => {
  const walk = (node: unknown): string => {
    const record = asRecord(node)
    if (!record) return ''
    if (typeof record.text === 'string') return record.text
    if (record.type === 'linebreak') return '\n'
    // A mention's words are part of the sentence (src/blocks/mention.ts).
    const fields = asRecord(record.fields)
    if (record.type === 'inlineBlock' && fields?.blockType === 'mention')
      return String(fields.label ?? '')
    const inner = asArray(record.children).map(walk).join('')
    return INLINE_NODES.has(String(record.type)) ? inner : `${inner}\n`
  }
  const data = asRecord(richText)
  return tidyLines(
    walk(
      data?.root
        ? flattenRichTextColumns(data as unknown as SerializedEditorState).root
        : undefined,
    ),
  )
}

/** Trims every line and drops the empty ones. */
const tidyLines = (text: string): string =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')

/** Any field value as searchable text: strings, numbers, rich text, lists. */
export const plainText = (value: unknown): string => {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number') return String(value)
  if (Array.isArray(value)) return value.map(plainText).filter(Boolean).join('\n')
  if (asRecord(value)?.root) return lexicalText(value)
  return ''
}

/** The whole course syllabus as one blob: session titles, descriptions,
 * activities and every bibliography entry, deduplicated in reading order. */
export const syllabusText = (course: Doc): string => {
  const lines: string[] = []
  const push = (value: unknown) => {
    for (const line of plainText(value).split('\n')) {
      if (line && !lines.includes(line)) lines.push(line)
    }
  }
  const pushBibliography = (entries: unknown) => {
    for (const entry of asArray(entries).map(asRecord)) {
      push(entry?.title)
      push(entry?.note)
    }
  }
  for (const session of asArray(course.sessions).map(asRecord)) {
    push(session?.session_title)
    push(session?.description)
    for (const activity of asArray(session?.activities).map(asRecord)) push(activity?.description)
    pushBibliography(session?.bibliography)
  }
  pushBibliography(course.bibliography)
  return lines.join('\n')
}

/** Every related person who stands behind the document: a course's
 * fellows; an article's authors, the original authors of a translation and
 * each credited person. */
const peopleOf = (collection: SearchCollection, doc: Doc): Doc[] => {
  const relations =
    collection === 'courses'
      ? [doc.fellows]
      : collection === 'articles'
        ? [
            doc.authors,
            asRecord(doc.translation)?.original_authors,
            ...asArray(doc.credits).map((credit) => asRecord(credit)?.people),
          ]
        : []
  return relations.flatMap(asArray).flatMap((person): Doc[] => {
    const record = asRecord(person)
    return record ? [record] : []
  })
}

/** The contributors of both language copies, matched by person id, each
 * once, in the English copy's order. */
export const contributorsOf = (
  collection: SearchCollection,
  copies: Record<SearchLocale, Doc>,
): Contributor[] => {
  const byId = new Map<string, Contributor>()
  for (const locale of SEARCH_LOCALES) {
    for (const person of peopleOf(collection, copies[locale])) {
      const id = String(person.id ?? person.name)
      const entry = byId.get(id) ?? { name: {} }
      const name = typeof person.name === 'string' ? person.name.trim() : ''
      if (name) entry.name[locale] = name
      entry.photo ||= mediaUrl(person.photo) || undefined
      byId.set(id, entry)
    }
  }
  return [...byId.values()].filter((entry) => entry.name.en || entry.name.ar)
}

/** One searchable field of one language copy. */
const fieldText = (
  collection: SearchCollection,
  field: string,
  copy: Doc,
  locale: SearchLocale,
) => {
  if (field === 'syllabus') return syllabusText(copy)
  if (field === 'owner') {
    return contributorsOf(collection, { en: {}, ar: {}, [locale]: copy })
      .map((entry) => entry.name[locale])
      .filter(Boolean)
      .join(', ')
  }
  return plainText(copy[field])
}

const timestamp = (value: unknown): number => {
  const ms =
    typeof value === 'string' || typeof value === 'number' ? new Date(value).getTime() : NaN
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * The bilingual record for one Payload document, or null when neither copy
 * has a title (an empty row has no place in the panel). An Arabic field
 * identical to its English twin stays empty: unlocalized text is indexed
 * once, so it matches and highlights once.
 */
export const toSearchDocument = (
  collection: SearchCollection,
  copies: Record<SearchLocale, Doc>,
): SearchDocument | null => {
  const { en } = copies
  if (en.id == null) return null
  const spec = SEARCH_COLLECTIONS[collection]

  const text: Record<string, string> = {}
  for (const field of Object.keys(spec.fields)) {
    const english = fieldText(collection, field, copies.en, 'en')
    const arabic = fieldText(collection, field, copies.ar, 'ar')
    text[localizedField(field, 'en')] = english
    text[localizedField(field, 'ar')] = arabic === english ? '' : arabic
  }

  const titles = {
    en: text[localizedField(spec.title, 'en')],
    ar: text[localizedField(spec.title, 'ar')] || text[localizedField(spec.title, 'en')],
  }
  if (!titles.en && !titles.ar) return null

  const contributors = contributorsOf(collection, copies)
  return {
    id: String(en.id),
    slug: typeof en.slug === 'string' ? en.slug : '',
    updatedAt: timestamp(en.updatedAt),
    coverImage: mediaUrl(collection === 'people' ? en.photo : en.cover_image),
    focalX: Number(asRecord(collection === 'people' ? en.photo : en.cover_image)?.focalX ?? 50),
    focalY: Number(asRecord(collection === 'people' ? en.photo : en.cover_image)?.focalY ?? 50),
    contributors: contributors.length ? JSON.stringify(contributors) : '',
    ...(collection === 'courses' ? { courseType: String(en.course_type ?? '') } : {}),
    [sortTitleField('en')]: (titles.en || titles.ar).toLocaleLowerCase('en'),
    [sortTitleField('ar')]: titles.ar.toLocaleLowerCase('ar'),
    ...text,
  }
}
