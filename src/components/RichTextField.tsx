import type { SerializedInlineBlockNode } from '@payloadcms/richtext-lexical'
import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { FootnoteMark } from '@/components/article/footnote'
import { ProfileCard } from '@/components/person/profile-card'
import { MovieCard } from '@/components/movie/movie-card'
import { movieSnapshotSchema } from '@/lib/movie'
import type { Footnote } from '@/lib/footnotes'
import type { ColumnsBlock, FootnoteBlock, PersonProfileBlock, MovieBlock } from '@/payload-types'
import styles from './rich-text-columns.module.css'

/** The dash (or tilde) that opens a quote's source line. */
const SOURCE_LEAD = /^\s*[—–~-]\s*/

/**
 * Renders Lexical rich text through Payload's own converters, so the frontend
 * emits the same structure the admin editor produces — headings, lists, quotes,
 * links, uploads — instead of flattening to plain text.
 *
 * Styling is Tailwind Typography's `prose`, which is what shadcn uses for
 * rendered rich text. Payload's admin stylesheet cannot be reused here: its
 * prose rules live in `@layer payload-default` and depend on the admin's
 * `--theme-*` custom properties.
 *
 * `footnotes` numbers the footnote inline blocks (see lib/footnotes.ts); each
 * renders as a mark with a hover card. `blocks` draws block nodes by their
 * block type, from data the caller has already loaded (the article page's
 * Card stacks): this component also renders inside client components.
 */
export const RichTextField: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  className?: string
  footnotes?: Footnote[]
  footnoteLabel?: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blocks?: Record<string, (fields: any) => React.ReactNode>
  /** As `blocks`, for inline blocks other than footnotes (the article page's mentions). */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  inlineBlocks?: Record<string, (fields: any) => React.ReactNode>
  /**
   * Only paragraphs, links, bold, italic, line breaks and lists. Headings and
   * quotes read as plain paragraphs (a heading in bold); images, rules, tables
   * and blocks are left out. For a short text shown in a small place.
   */
  plain?: boolean
}> = ({
  data,
  className,
  footnotes = [],
  footnoteLabel = 'Note',
  blocks = {},
  inlineBlocks = {},
  plain = false,
}) => {
  if (!data) return null

  const renderColumns = ({ node }: { node: { fields: ColumnsBlock } }) => {
    const { first, second, third, fourth, ratio, columnCount } = node.fields
    const count = Number(columnCount ?? 2)
    const columns = [first, second, third, fourth].slice(0, count)
    const profileCarousel =
      !plain &&
      columns.length > 1 &&
      columns.every((column) =>
        column?.root.children.some(
          (child) =>
            child.type === 'block' &&
            typeof child.fields === 'object' &&
            child.fields !== null &&
            'blockType' in child.fields &&
            child.fields.blockType === 'personProfile',
        ),
      )
    return (
      <div
        className={plain ? undefined : styles.columns}
        data-ratio={ratio}
        data-columns={count}
        data-profile-carousel={profileCarousel || undefined}
      >
        {columns.map((column, index) => (
          <RichTextField
            key={index}
            data={column}
            className={styles.column}
            plain={plain}
            blocks={blocks}
            inlineBlocks={inlineBlocks}
            footnotes={footnotes}
            footnoteLabel={footnoteLabel}
          />
        ))}
      </div>
    )
  }

  const renderPersonProfile = ({ node }: { node: { fields: PersonProfileBlock } }) => {
    const { person } = node.fields
    if (!person || typeof person !== 'object' || !person.visible || !person.slug) return null
    return (
      <ProfileCard person={person}>
        {person.bio && (
          <RichTextField data={person.bio} plain className="article-prose article-prose--bio" />
        )}
      </ProfileCard>
    )
  }

  const fullConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    // A quote whose last line starts with a dash ("— Pascal", written in the
    // editor as a line break then the source) gets that line as its citation.
    quote: ({ node, nodesToJSX }) => {
      const kids = (node as { children: SerializedLexicalNode[] }).children
      let at = -1
      kids.forEach((k, i) => {
        const next = kids[i + 1] as { type?: string; text?: string } | undefined
        if (k.type === 'linebreak' && next?.type === 'text' && SOURCE_LEAD.test(next.text ?? ''))
          at = i
      })
      if (at === -1) return <blockquote>{nodesToJSX({ nodes: kids })}</blockquote>
      const first = kids[at + 1] as SerializedLexicalNode & { text: string }
      const source = [
        { ...first, text: first.text.replace(SOURCE_LEAD, '') },
        ...kids.slice(at + 2),
      ]
      return (
        <blockquote className="quote-with-source">
          <p>{nodesToJSX({ nodes: kids.slice(0, at) })}</p>
          <footer>
            <cite>{nodesToJSX({ nodes: source })}</cite>
          </footer>
        </blockquote>
      )
    },
    blocks: {
      columns: renderColumns,
      personProfile: renderPersonProfile,
      movie: ({ node }: { node: { fields: MovieBlock } }) => {
        const parsed = movieSnapshotSchema.safeParse(node.fields.movie)
        return parsed.success ? (
          <MovieCard movie={parsed.data} subtitleLanguages={node.fields.subtitleLanguages ?? []} />
        ) : null
      },
      ...Object.fromEntries(
        Object.entries(blocks).map(([type, draw]) => [
          type,
          ({ node }: { node: { fields: unknown } }) => draw(node.fields),
        ]),
      ),
    },
    inlineBlocks: {
      ...Object.fromEntries(
        Object.entries(inlineBlocks).map(([type, draw]) => [
          type,
          ({ node }: { node: { fields: unknown } }) => draw(node.fields),
        ]),
      ),
      footnote: ({ node }: { node: SerializedInlineBlockNode<FootnoteBlock> }) => {
        const f = footnotes.find((x) => x.id === node.fields.id)
        return f ? <FootnoteMark label={footnoteLabel} note={f.note} number={f.number} /> : null
      },
    },
  })

  const plainConverters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    heading: ({ node, nodesToJSX }) => (
      <p>
        <strong>
          {nodesToJSX({ nodes: (node as { children: SerializedLexicalNode[] }).children })}
        </strong>
      </p>
    ),
    quote: ({ node, nodesToJSX }) => (
      <p>{nodesToJSX({ nodes: (node as { children: SerializedLexicalNode[] }).children })}</p>
    ),
    text: ({ node }) => {
      const { text, format } = node as { text: string; format: number }
      // Lexical's text format bits: 1 bold, 2 italic.
      const italic = format & 2 ? <em>{text}</em> : text
      return format & 1 ? <strong>{italic}</strong> : italic
    },
    upload: () => null,
    horizontalrule: () => null,
    table: () => null,
    blocks: { columns: renderColumns, personProfile: () => null, movie: () => null },
    inlineBlocks: {},
  })

  return (
    <RichText
      className={className ?? 'prose prose-neutral max-w-none dark:prose-invert'}
      converters={plain ? plainConverters : fullConverters}
      data={data}
    />
  )
}
