import {
  convertLexicalToMarkdown,
  editorConfigFactory,
  ServerBlockNode,
  ServerInlineBlockNode,
  $isServerBlockNode,
  $isServerInlineBlockNode,
} from '@payloadcms/richtext-lexical'
import type { SanitizedServerEditorConfig } from '@payloadcms/richtext-lexical'
import type { SerializedEditorState } from '@payloadcms/richtext-lexical/lexical'
import type { Payload } from 'payload'

import { getRelatedArticles, type Locale } from '@/api/articles.api'
import { resolveMentions, type ResolvedMention } from '@/api/mentions.api'
import { COURSE_TYPE_OPTIONS } from '@/fields/course-type'
import { env } from '@/env'
import { WEEKDAYS } from '@/lib/cairo-day'
import { footnotesOf } from '@/lib/footnotes'
import { flattenRichTextColumns } from '@/lib/flatten-rich-text-columns'
import { articleBodyFeatures } from '@/lexical/article-body'
import { pathOf } from '@/lib/paths'
import { priceLabel, pricingFor } from '@/lib/pricing'
import { registrationStatus, type Registration } from '@/lib/registration'
import { expandSchedule, sessionsInOrder } from '@/lib/schedule'
import type { Article, Course, Person, Publication } from '@/payload-types'

/**
 * The per-page llms.txt twin: the page's content as one structured markdown
 * document, everything an anonymous visitor may read, every link absolute. It
 * is what "talk with AI" points assistants at (src/lib/ai-study.ts) instead of
 * messy page HTML.
 */

export type LlmsSection = {
  /** Empty: the body follows the document header directly. */
  heading: string
  /** Markdown, newline-joined already. */
  body: string
}

export type LlmsDocument = {
  title: string
  summary?: string | null
  pageUrl: string
  sections: LlmsSection[]
}

export type SiteLink = { locale: Locale; serverUrl: string }

const contextOf = (locale: Locale): SiteLink => ({
  locale,
  serverUrl: env.NEXT_PUBLIC_SERVER_URL,
})

export const linkTo = (l: SiteLink, path: string | null | undefined): string | null =>
  path ? `${l.serverUrl.replace(/\/+$/, '')}/${l.locale}${path}` : null

export const documentToMarkdown = (doc: LlmsDocument): string => {
  const parts = [`# ${doc.title}`]
  if (doc.summary) parts.push(doc.summary)
  parts.push(`Human page: ${doc.pageUrl}`)
  for (const section of doc.sections) {
    if (section.heading) parts.push(`## ${section.heading}`)
    const body = section.body.trim()
    if (body) parts.push(body)
  }
  return `${parts.join('\n\n')}\n`
}

export const factsList = (facts: Array<[string, string | null | undefined]>): string =>
  facts
    .filter(([, value]) => Boolean(value))
    .map(([label, value]) => `**${label}:** ${value}`)
    .join('\n')

export const bulletList = (items: Array<string | null | undefined>): string =>
  items.filter(Boolean).map((item) => `- ${item}`).join('\n')

const BIBLIOGRAPHY_LABELS: Record<string, Record<Locale, string>> = {
  reading: { en: 'Reading', ar: 'قراءة' },
  watch: { en: 'Watch', ar: 'مشاهدة' },
  listen: { en: 'Listen', ar: 'استماع' },
  prompt: { en: 'Prompt', ar: 'سؤال' },
  other: { en: 'Other', ar: 'أخرى' },
}

export const bibliographyLine = (
  item:
    | { type?: string | null; title?: string | null; href?: string | null; note?: string | null }
    | null
    | undefined,
  locale: Locale,
): string | null => {
  if (!item?.title) return null
  const kind = BIBLIOGRAPHY_LABELS[item.type ?? 'other']?.[locale] ?? BIBLIOGRAPHY_LABELS.other[locale]
  const note = item.note ? ` — ${item.note}` : ''
  const href = item.href ? `. ${item.href.trim()}` : ''
  return `- [${kind}] ${item.title}${note}${href}`
}

const markdownHref = (text: string, link: string | null): string => (link ? `[${text}](${link})` : text)

const personLink = (l: SiteLink, person: Person | null | undefined): string | null => {
  if (!person?.name && !person?.slug) return null
  return markdownHref(person.name || person.slug, linkTo(l, pathOf('people', person)))
}

const namesLinks = (l: SiteLink, people: (number | Person)[] | null | undefined): string | null => {
  const links = (people ?? [])
    .filter((p): p is Person => typeof p === 'object' && p !== null)
    .map((p) => personLink(l, p))
    .filter(Boolean)
  return links.length ? links.join(', ') : null
}

const personName = (person: Person | null | undefined): string | null =>
  person?.name || person?.slug || null

const COURSE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  COURSE_TYPE_OPTIONS.map((o) => [o.value, o.label]),
)

const typeLabel = (value: string): string => COURSE_TYPE_LABELS[value] ?? value

const WEEKDAY_LABELS: Record<(typeof WEEKDAYS)[number], Record<Locale, string>> = {
  sat: { en: 'Saturday', ar: 'السبت' },
  sun: { en: 'Sunday', ar: 'الأحد' },
  mon: { en: 'Monday', ar: 'الإثنين' },
  tue: { en: 'Tuesday', ar: 'الثلاثاء' },
  wed: { en: 'Wednesday', ar: 'الأربعاء' },
  thu: { en: 'Thursday', ar: 'الخميس' },
  fri: { en: 'Friday', ar: 'الجمعة' },
}

const LOCATION_LABELS: Record<string, Record<Locale, string>> = {
  OFFLINE: { en: 'Offline (in person)', ar: 'حضوري' },
  ONLINE: { en: 'Online', ar: 'عن بُعد' },
  HYBRID: { en: 'Hybrid', ar: 'مزيج' },
}

const LANGUAGE_LABELS: Record<string, Record<Locale, string>> = {
  ar: { en: 'Arabic', ar: 'العربية' },
  en: { en: 'English', ar: 'الإنجليزية' },
}

const ORIGINAL_LANGUAGES: Record<string, Record<Locale, string>> = {
  ...LANGUAGE_LABELS,
  de: { en: 'German', ar: 'الألمانية' },
  fr: { en: 'French', ar: 'الفرنسية' },
  other: { en: 'Other', ar: 'أخرى' },
}

const SECTION_LABELS = {
  en: {
    facts: 'Practical facts',
    overview: 'Overview',
    description: 'Description',
    fellows: 'Fellows',
    notes: 'Practical notes',
    syllabus: 'Syllabus',
    bibliography: 'Bibliography',
    endnotes: 'Endnotes',
    authors: 'Authors',
    published: 'Published',
    credits: 'Credits',
    tags: 'Tags',
    publication: 'Publication',
    related: 'Related articles',
    original: 'Original',
    activities: 'Activities',
    readings: 'Readings',
    cancelled: 'cancelled',
    meetings: 'Meetings',
    week: 'Week',
    session: 'Session',
    subtitle: 'Subtitle',
    summary: 'Summary',
    syllabusMayChange: 'The syllabus may still change.',
    registerDeadline: 'Application deadline',
    registrationOpen: 'Registration open',
    registrationClosed: 'Registration closed',
  },
  ar: {
    facts: 'معلومات عملية',
    overview: 'لمحة',
    description: 'الوصف',
    fellows: 'المدرّسون',
    notes: 'ملاحظات عملية',
    syllabus: 'المقرّر',
    bibliography: 'قائمة المصادر',
    endnotes: 'الهوامش',
    authors: 'المؤلفون',
    published: 'نُشر',
    credits: 'إسهامات',
    tags: 'الوسوم',
    publication: 'المنشور',
    related: 'مقالات ذات صلة',
    original: 'الأصل',
    activities: 'في الجلسة',
    readings: 'القراءات',
    cancelled: 'أُلغيت',
    meetings: 'اللقاءات',
    week: 'الأسبوع',
    session: 'الجلسة',
    subtitle: 'العنوان الفرعي',
    summary: 'مختصر',
    syllabusMayChange: 'قد يتغيّر المقرّر.',
    registerDeadline: 'آخر موعد للتقديم',
    registrationOpen: 'التسجيل مفتوح',
    registrationClosed: 'التسجيل مغلق',
  },
}

const labelsOf = (locale: Locale) => SECTION_LABELS[locale]

/** The never-matching regExp makes the transformer export-only. */
const INERT_REGEXP = /~never-in-markdown~/g

const fieldsOf = (node: unknown): { id?: string; blockType?: string; [k: string]: unknown } =>
  ($isServerInlineBlockNode(node as never) || $isServerBlockNode(node as never)
    ? (node as { getFields: () => unknown }).getFields()
    : {}) as { id?: string; blockType?: string }

/** A mention's own page; these paths carry no language yet. */
const mentionUrl = (l: SiteLink, resolved: ResolvedMention): string | null =>
  resolved.href && resolved.href.startsWith('/')
    ? `${l.serverUrl.replace(/\/+$/, '')}/${l.locale}${resolved.href}`
    : null

const absolutize = (markdown: string, { serverUrl }: SiteLink): string =>
  markdown.replace(
    /\]\((?!https?:|mailto:|tel:|#)(\/[^)\s]*)\)/g,
    (_, href) => `](${serverUrl.replace(/\/+$/, '')}${href})`,
  )

/** Clones the editor config's transformer list, so the cached default is never mutated. */
const withExtraTransformers = (base: SanitizedServerEditorConfig): SanitizedServerEditorConfig => ({
  ...base,
  features: { ...base.features, markdownTransformers: [...base.features.markdownTransformers] },
})

const toMarkdown = async (
  payload: Payload,
  data: unknown,
  l: SiteLink,
  options: {
    features?: typeof articleBodyFeatures
    mentions?: Record<string, ResolvedMention>
    footnotes?: Map<string, number>
  } = {},
): Promise<string> => {
  if (!data || typeof data !== 'object' || !('root' in data)) return ''
  const base = await (options.features
    ? editorConfigFactory.fromFeatures({ config: payload.config, features: options.features })
    : editorConfigFactory.default({ config: payload.config }))
  const editorConfig = withExtraTransformers(base)

  editorConfig.features.markdownTransformers.push(
    {
      type: 'text-match',
      dependencies: [ServerInlineBlockNode],
      regExp: INERT_REGEXP,
      export: (node) => {
        const f = fieldsOf(node)
        if ($isServerInlineBlockNode(node) && f.blockType === 'footnote') {
          const n = f.id ? options.footnotes?.get(f.id) : undefined
          if (n) return `[^${n}]`
        }
        return null
      },
    },
    {
      type: 'text-match',
      dependencies: [ServerInlineBlockNode],
      regExp: INERT_REGEXP,
      export: (node) => {
        const f = fieldsOf(node)
        if (!$isServerInlineBlockNode(node) || f.blockType !== 'mention') return null
        const label = String(f.label ?? '')
        const resolved = f.id ? options.mentions?.[f.id] : undefined
        return resolved ? markdownHref(label, mentionUrl(l, resolved)) : label
      },
    },
    {
      type: 'element',
      dependencies: [ServerBlockNode],
      regExp: INERT_REGEXP,
      replace: () => false,
      export: (node) => {
        const f = fieldsOf(node)
        if (!$isServerBlockNode(node)) return null
        return `[Card: ${String(f.label || f.blockType || 'cards')}]`
      },
    },
    // Last resort for an inline block this file has no renderer for: it is
    // spoken of, not dropped, leaked as raw data, or thrown on.
    {
      type: 'text-match',
      dependencies: [ServerInlineBlockNode],
      regExp: INERT_REGEXP,
      export: (node) => {
        const f = fieldsOf(node)
        if (!$isServerInlineBlockNode(node)) return null
        return `[Note: ${String(f.blockType || 'inline block')}]`
      },
    },
  )

  return absolutize(
    convertLexicalToMarkdown({
      data: flattenRichTextColumns(data as SerializedEditorState),
      editorConfig,
    }).trim(),
    l,
  )
}

export const endnotesOf = async (  payload: Payload,
  body: unknown,
  l: SiteLink,
): Promise<Array<{ id: string; number: number; markdown: string }>> => {
  const footnotes = footnotesOf(body as never)
  const notes: Array<{ id: string; number: number; markdown: string }> = []
  for (const note of footnotes) {
    notes.push({
      id: note.id,
      number: note.number,
      markdown: await toMarkdown(payload, note.note, l),
    })
  }
  return notes
}

const articleBodyToMarkdown = async (
  payload: Payload,
  body: unknown,
  l: SiteLink,
  footnotes: Map<string, number>,
): Promise<string> => {
  const mentions = await resolveMentions(payload, body, { locale: l.locale, user: null })
  return toMarkdown(payload, body, l, { features: articleBodyFeatures, mentions, footnotes })
}

export const courseDocument = async (
  payload: Payload,
  course: Course,
  locale: Locale,
): Promise<LlmsDocument> => {
  const l = contextOf(locale)
  const t = labelsOf(locale)
  const cycle = typeof course.cycle === 'object' ? course.cycle : null
  const meetings = expandSchedule(course.schedule, course.sessions ?? [])

  const slotLines = (course.schedule?.slots ?? [])
    .filter((slot) =>
      meetings.some(
        (m) => !m.cancelled && m.start_time === slot.start_time && m.end_time === slot.end_time,
      ),
    )
    .map(
      (slot) =>
        `${WEEKDAY_LABELS[slot.weekday]?.[locale] ?? slot.weekday} ${slot.start_time}–${slot.end_time}`,
    )
  const meetingsLine = slotLines.length
    ? `${slotLines.join(locale === 'ar' ? '، ' : ', ')} (Cairo)`
    : null

  const price = priceLabel(pricingFor(course, cycle))
  const priceNote = course.pricing_override?.note || null
  const registration = course.registration as Registration | null
  const registrationOpen =
    registrationStatus(registration, cycle?.registration as Registration | null) === 'open'

  const facts = factsList([
    [locale === 'ar' ? 'النوع' : 'Type', typeLabel(course.course_type)],
    ['Cycle', cycle?.title ?? null],
    [locale === 'ar' ? 'تبدأ' : 'Starts', course.schedule?.start_date ?? null],
    [locale === 'ar' ? 'تنتهي' : 'Ends', course.schedule?.end_date || null],
    [locale === 'ar' ? 'اللقاءات' : 'Meets', meetingsLine],
    [
      locale === 'ar' ? 'المكان' : 'Location',
      (course.location ?? [])
        .map((place) => LOCATION_LABELS[place]?.[locale] ?? place)
        .join(locale === 'ar' ? '، ' : ' / ') || null,
    ],
    [
      locale === 'ar' ? 'لغات التدريس' : 'Taught in',
      (course.teaching_languages ?? [])
        .map((lang) => LANGUAGE_LABELS[lang]?.[locale] ?? lang)
        .join(locale === 'ar' ? '، ' : ', ') || null,
    ],
    [locale === 'ar' ? 'ملاحظة اللغة' : 'Language note', course.language_note || null],
    [locale === 'ar' ? 'السعر' : 'Price', price ? `${price}${priceNote ? ` — ${priceNote}` : ''}` : null],
    [t.registerDeadline, registration?.deadline ?? cycle?.registration?.deadline ?? null],
    [
      locale === 'ar' ? 'التقديم' : 'Apply',
      registrationOpen && registration?.method === 'external' && registration.url
        ? registration.url
        : null,
    ],
    [
      locale === 'ar' ? 'السجل' : 'Registration',
      registrationOpen ? t.registrationOpen : t.registrationClosed,
    ],
  ])

  const overview = [
    course.subtitle ? `${t.subtitle}: ${course.subtitle}` : null,
    course.summary ? `${t.summary}: ${course.summary}` : null,
    course.epigraph ? `> ${course.epigraph}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const description = await toMarkdown(payload, course.description?.description, l)

  const fellows = (course.fellows ?? []).filter((p): p is Person => typeof p === 'object' && p !== null)
  const fellowBlocks = await Promise.all(
    fellows.map(async (fellow) => {
      const name = personName(fellow)
      if (!name) return null
      const bio = await toMarkdown(payload, fellow.bio, l)
      const profile = linkTo(l, pathOf('people', fellow))
      return [markdownHref(name, profile), bio].filter(Boolean).join('\n\n')
    }),
  )

  const unitWord = course.session_unit === 'week' ? t.week : t.session
  const sessionBlocks = await Promise.all(
    sessionsInOrder(course.sessions ?? []).map(async (session, index) => {
      const number = index + 1
      const title = session.session_title || `${unitWord} ${number}`
      const heading = `### ${title.replaceAll('#', '').trim()}${session.cancelled ? ` (${t.cancelled})` : ''}`
      const count = meetings.filter((m) => !m.cancelled && m.session === number).length
      const extraDates = (session.dates ?? [])
        .map((d) => `${d.date} ${d.start_time}–${d.end_time}`)
        .join(locale === 'ar' ? '، ' : ', ')
      const descriptionMarkdown = await toMarkdown(payload, session.description, l)
      const activities = bulletList(
        (session.activities ?? []).map(
          (a) => `${a.kind}${a.description ? ` — ${a.description}` : ''}`,
        ),
      )
      const readings = bulletList(
        (session.bibliography ?? []).map((item) => bibliographyLine(item, locale) ?? null),
      )
      return [
        heading,
        `${t.meetings}: ${count}`,
        ...(extraDates ? [`Dates: ${extraDates}`] : []),
        descriptionMarkdown,
        activities ? `${t.activities}\n${activities}` : null,
        readings ? `${t.readings}\n${readings}` : null,
      ]
        .filter(Boolean)
        .join('\n\n')
    }),
  )

  const courseBibliography = bulletList(
    (course.bibliography ?? []).map((item) => bibliographyLine(item, locale) ?? null),
  )

  return {
    title: course.title,
    summary: course.summary || null,
    pageUrl: linkTo(l, pathOf('courses', course)) ?? '',
    sections: [
      { heading: t.facts, body: facts },
      ...(overview ? [{ heading: t.overview, body: overview }] : []),
      ...(description ? [{ heading: t.description, body: description }] : []),
      ...fellowBlocks.filter(Boolean).map((body) => ({ heading: t.fellows, body: body as string })),
      ...(course.facilitator_note || course.content_warning
        ? [
            {
              heading: t.notes,
              body: [course.facilitator_note, course.content_warning]
                .filter(Boolean)
                .join('\n'),
            },
          ]
        : []),
      ...(sessionBlocks.length || course.syllabus_tentative
        ? [
            {
              heading: t.syllabus,
              body: [
                ...(course.syllabus_tentative ? [t.syllabusMayChange] : []),
                ...sessionBlocks,
              ]
                .filter(Boolean)
                .join('\n\n'),
            },
          ]
        : []),
      ...(courseBibliography ? [{ heading: t.bibliography, body: courseBibliography }] : []),
    ],
  }
}

export const articleDocument = async (
  payload: Payload,
  article: Article,
  body: unknown,
  locale: Locale,
): Promise<LlmsDocument> => {
  const l = contextOf(locale)
  const t = labelsOf(locale)

  const translation = article.translation
  const hasOriginal = Boolean(translation?.original_title || translation?.original_source)
  const originalLanguage = translation?.original_language
    ? ORIGINAL_LANGUAGES[translation.original_language]?.[locale]
    : null

  const facts = factsList([
    [t.authors, namesLinks(l, article.authors)],
    [t.published, article.published_date?.slice(0, 10) ?? null],
    [
      t.credits,
      (article.credits ?? [])
        .map((credit) => {
          const role = credit.label || credit.role
          const names = namesLinks(l, credit.people)
          return names ? `${role}: ${names}` : null
        })
        .filter(Boolean)
        .join(' · ') || null,
    ],
    [t.tags, (article.tags ?? []).map((x) => x.tag).filter(Boolean).join(', ') || null],
    [
      t.publication,
      (article.publications?.docs ?? [])
        .filter((p): p is Publication => typeof p === 'object' && p !== null && Boolean(p.slug))
        .map((p) => markdownHref(p.title, `${l.serverUrl.replace(/\/+$/, '')}/${l.locale}/articles?publication=${encodeURIComponent(p.slug)}`))
        .join(', ') || null,
    ],
    ...(((hasOriginal && translation)
      ? [
          [
            t.original,
            [
              translation.original_language && originalLanguage
                ? `(${originalLanguage})`
                : null,
              translation.original_title ? `“${translation.original_title}”` : null,
              namesLinks(l, translation.original_authors),
              translation.original_source,
            ]
              .filter(Boolean)
              .join(' — ') || null,
          ],
          [locale === 'ar' ? 'الرابط' : 'Link', translation.original_url ?? null],
          [
            locale === 'ar' ? 'ملاحظة المترجم' : 'Translation note',
            translation.note ?? null,
          ],
        ]
      : []) as Array<[string, string | null | undefined]>),
  ]) as never

  const notes = await endnotesOf(payload, body, l)
  const footnoteNumbers = new Map(notes.map((note) => [note.id, note.number]))
  const bodyMarkdown = await articleBodyToMarkdown(payload, body, l, footnoteNumbers)
  const endnotes = notes.map((n) => `[^${n.number}]: ${n.markdown}`).join('\n')

  const related = await getRelatedArticles(payload, article, l.locale, 5, null)
  const relatedList = bulletList(
    related
      .map((a) => markdownHref(a.title, linkTo(l, pathOf('articles', a)) ?? null))
      .filter(Boolean),
  )

  return {
    title: article.title || '',
    summary: article.meta?.description || null,
    pageUrl: linkTo(l, pathOf('articles', article)) ?? '',
    sections: [
      { heading: t.facts, body: facts },
      ...(bodyMarkdown ? [{ heading: '', body: bodyMarkdown }] : []),
      ...(endnotes ? [{ heading: t.endnotes, body: endnotes }] : []),
      ...(relatedList ? [{ heading: t.related, body: relatedList }] : []),
    ],
  }
}
