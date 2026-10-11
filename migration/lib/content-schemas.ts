import * as z from 'zod'

export const CONTENT_PROMPT_VERSION = '1'

export const Block = z.object({
  type: z.enum(['heading', 'paragraph', 'quote', 'list_item', 'note']),
  level: z.number().int().min(2).max(4).nullable(),
  text: z.string().min(1),
})

// Pass 1: what a long document contains, and where.
export const Toc = z.object({
  front_matter_pages: z.array(z.number().int().positive()), // imprint/credits pages
  essays: z.array(
    z.object({
      order: z.number().int().positive(),
      title: z.string().min(1),
      authors: z.array(z.string()),
      first_page: z.number().int().positive(),
      last_page: z.number().int().positive(),
      is_foreword: z.boolean(),
    }),
  ),
  imprint: z.object({
    credits: z.array(z.object({ role: z.string(), names: z.array(z.string()) })),
    license: z.string().nullable(),
    year: z.number().int().nullable(),
  }),
})

// Pass 2: one essay in full.
export const Essay = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable(),
  authors: z.array(z.string()),
  translators: z.array(z.string()),
  original: z
    .object({
      title: z.string().nullable(),
      authors: z.array(z.string()),
      source: z.string().nullable(),
    })
    .nullable(),
  blocks: z.array(Block).min(1),
})

const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)

export const PressPage = z.object({
  items: z.array(
    z.object({
      title: z.string().min(1),
      outlet: z.string().nullable(),
      authors: z.array(z.string()),
      kind: z.enum(['coverage', 'interview', 'talk', 'op_ed']),
      date: z
        .string()
        .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
        .nullable(),
      links: z.array(
        z.object({
          language: z.enum(['ar', 'en', 'de', 'fr', 'other']).nullable(),
          url: z.string(),
        }),
      ),
      excerpt: z.string().nullable(),
      logo: z.string().nullable(),
    }),
  ),
})

export const NewsPage = z.object({
  posts: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      is_gathering: z.boolean(),
      event_type: z
        .enum([
          'talk',
          'panel',
          'book_discussion',
          'reading_group',
          'screening',
          'performance',
          'music',
          'exhibition',
          'open_day',
          'workshop',
          'residency',
          'visit',
          'other',
        ])
        .nullable(),
      start_time: Time.nullable(),
      end_time: Time.nullable(),
      speakers: z.array(z.string()),
      blocks: z.array(Block),
    }),
  ),
})

export const BlogPage = z.object({
  posts: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .nullable(),
      authors: z.array(z.string()),
      blocks: z.array(Block).min(1),
    }),
  ),
})

export const PublicationPage = z.object({
  title: z.string(),
  subtitle: z.string().nullable(),
  intro: z.array(Block),
  credits: z.array(z.object({ role: z.string(), names: z.array(z.string()) })),
  funders: z.array(z.string()),
  license: z.string().nullable(),
})

export const NewsletterSources = z.object({
  issues: z.array(
    z.object({
      title: z.string().min(1),
      date: z
        .string()
        .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/)
        .nullable(),
      archive_url: z.string().nullable(),
      blocks: z.array(Block),
    }),
  ),
})

export type Toc = z.infer<typeof Toc>
export type Essay = z.infer<typeof Essay>
export type PressPage = z.infer<typeof PressPage>
export type NewsPage = z.infer<typeof NewsPage>
export type BlogPage = z.infer<typeof BlogPage>
export type PublicationPage = z.infer<typeof PublicationPage>
export type NewsletterSources = z.infer<typeof NewsletterSources>

/* ================================================================= prompts */

type Link = { page?: number; text?: string; url: string }

const BLOCKS_RULE = `Blocks: each block is one of heading (level 2-4; a section heading, not the document title), paragraph, quote (a block quotation), list_item (one bullet or numbered entry), note (a footnote or endnote, with its number). level is null unless type is heading. Keep every paragraph, in order, one block per paragraph; join lines broken by the page layout and fix hyphenation at line ends.`

const VERBATIM = `- Verbatim only: copy text exactly as written, in its own language. Never translate, summarise or correct.`

const imagesPart = (images: string[], what: string): string =>
  images.length
    ? `\nThis ${what} is read from page images, because its text layer is unreliable (Arabic text layers come out reversed or scrambled). Read every page image below with your Read tool. The OCR text that follows is only a helper; trust the images:\n${images.map((p) => `- ${p}`).join('\n')}\n`
    : ''

const linksPart = (links: Link[]): string =>
  links.length
    ? `\nThe source's links (a page shows only the anchor words, not the addresses). Keep every one, attached to what it belongs to:\n${links.map((l) => `- ${l.page ? `page ${l.page}: ` : ''}${l.text ? `${l.text}: ` : ''}${l.url}`).join('\n')}\n`
    : ''

const body = (label: string, text: string): string => `\n${label}:\n"""\n${text}\n"""`

/** Pass 1: the table of contents and imprint of a long document. */
export const tocPrompt = ({
  id,
  pageCount,
  pages,
  text,
  images,
}: {
  id: string
  pageCount: number
  /** The page numbers shown below (the first six and the last two). */
  pages: number[]
  text: string
  images: string[]
}): string => `You are reading the front and back matter of one CILAS publication to find where each essay starts and ends. The document is ${id}; it has ${pageCount} pages. You are given pages ${pages.join(', ')}.

Rules:
${VERBATIM}
- essays: one per essay or chapter in the table of contents, in the book's order, order starting at 1. first_page and last_page are PDF page numbers (the first page of the file is 1), not the numbers printed on the pages: work out the offset. Each essay ends the page before the next one starts; the last ends before any back matter (biographies, endnotes of the whole book, colophon) unless its notes belong to it.
- is_foreword: true for a foreword, preface or introduction by the editors; false for essays.
- authors: the essay's authors as the contents page or the essay's first page names them.
- front_matter_pages: the PDF pages holding the imprint, credits and copyright (not the contents).
- imprint.credits: every credit line (editor, translator, copy editor, proofreader, supervisor, coordinator, art director, cover designer ...) with the names. role: the role as printed, in lower-case English snake_case if you can tell (editor, translator, copy_editor, proofreader, supervisor, coordinator, art_director, cover_designer), otherwise as printed.
- imprint.license: the licence line as printed (e.g. CC BY-NC-SA); null if none. imprint.year: the publication year; null if not stated.
${imagesPart(images, 'document')}${body('Text of the given pages (page markers separate them)', text)}`

/** Pass 2: one essay, from only its pages. */
export const essayPrompt = ({
  id,
  doc,
  title,
  authors,
  firstPage,
  lastPage,
  text,
  images,
}: {
  id: string
  doc: string
  title: string
  authors: string[]
  firstPage: number
  lastPage: number
  text: string
  images: string[]
}): string => `You are copying one essay of a CILAS publication into structured blocks. Unit: ${id}. Document: ${doc}. The essay is "${title}"${authors.length ? ` by ${authors.join(', ')}` : ''}, on PDF pages ${firstPage} to ${lastPage}.

Rules:
${VERBATIM}
- Every paragraph of the essay, in order. Leave nothing out and add nothing: no page numbers, running heads, running titles or contents entries. Do not repeat the essay title as a heading.
- title, subtitle: as the essay's first page prints them (subtitle null if none).
- authors: the essay's authors. translators: the translator named on the essay, or in a note at its start or end; [] if none.
- original: only when the essay is a translation and says what it was translated from: the original title, its authors and the source (journal, book, year) as given; null otherwise.
- Headings inside the essay are heading blocks (level 2 for main sections, 3 and 4 below).
- Footnotes and endnotes are note blocks (keep their numbers at the start of the text), in order, after the body.
- ${BLOCKS_RULE}
${imagesPart(images, 'essay')}${body('Essay text', text)}`

const pageHead = (what: string, id: string): string =>
  `You are turning ${what} of the CILAS website (archived) into structured data. Source: ${id}.\n\nRules:\n${VERBATIM}\n- Use only what the page says. When the page does not state something, use null (or an empty list).\n- Every link the page gives is kept, exactly as written.`

export const pressPrompt = ({
  id,
  text,
}: {
  id: string
  text: string
}): string => `${pageHead('the press page', id)}
- items: one per press item (article, interview, talk, op-ed) the page lists. The page also lists the newsletter issues (CILAS Newsletter, CILAS Alex: dated links to campaign archives and similar); they are not press items, so leave them out. title as given; outlet is the publication or channel named; authors are the bylines.
- kind: coverage (written about CILAS), interview, talk (a recorded or filmed talk), op_ed (written by a CILAS person).
- date: YYYY, YYYY-MM or YYYY-MM-DD, exactly as precise as the page states; null if absent.
- links: each link with its language (ar, en, de, fr, other) when the page or the link text says so; null otherwise.
- excerpt: the quoted passage under the item, if any. logo: the item's image path, if any.
${body('Page text', text)}`

export const newsPrompt = ({
  id,
  text,
}: {
  id: string
  text: string
}): string => `${pageHead('the news page', id)}
- posts: one per news post, in page order.
- is_gathering: true when the post announces a gathering people attend (open day, talk, panel, workshop, screening, performance, exhibition, visit); false for calls for applications or other news.
- event_type: for a gathering, the closest type; null otherwise.
- date: the date of the gathering for a gathering, otherwise the post's date; YYYY-MM-DD, null if absent. start_time, end_time: HH:MM 24-hour, only when stated.
- speakers: the people named as speaking or leading.
- ${BLOCKS_RULE}
${body('Page text', text)}`

export const blogPrompt = ({
  id,
  text,
}: {
  id: string
  text: string
}): string => `${pageHead('the blog page', id)}
- posts: one per blog post, in page order, each in full.
- authors: the bylines, [] if none. date: YYYY-MM-DD, null if absent.
- ${BLOCKS_RULE}
${body('Page text', text)}`

export const publicationPrompt = ({
  id,
  text,
}: {
  id: string
  text: string
}): string => `${pageHead('a publication page', id)}
- title, subtitle: the publication's own. intro: the page's descriptive text as blocks.
- credits: each credit line (editor, translator, copy_editor, proofreader, supervisor, coordinator, art_director, cover_designer) with the names; role in that snake_case when it fits, otherwise as written.
- funders: the organisations named as funding or supporting it. license: the licence line; null if none.
- ${BLOCKS_RULE}
${body('Page text', text)}`

export const newsletterPrompt = ({
  id,
  text,
  mailchimp = [],
  images = [],
}: {
  id: string
  text: string
  /** Campaign-archive links found on the site's pages. */
  mailchimp?: Link[]
  images?: string[]
}): string => `${pageHead('newsletter material', id)}
- issues: one per newsletter issue. For a PDF issue, the issue's full text as blocks. For a campaign-archive link, an issue with archive_url = the link and blocks = [] (the archive itself is not read).
- title: the issue's title as given (the link text for a link); date: YYYY, YYYY-MM or YYYY-MM-DD from the text, the link text or the archive URL; null if undated.
- ${BLOCKS_RULE}
${linksPart(mailchimp)}${imagesPart(images, 'document')}${body('Source text', text)}`
