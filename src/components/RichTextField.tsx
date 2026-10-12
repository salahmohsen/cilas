import type { SerializedInlineBlockNode } from '@payloadcms/richtext-lexical'
import type { SerializedLexicalNode } from '@payloadcms/richtext-lexical/lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { FootnoteMark } from '@/components/article/footnote'
import type { Footnote } from '@/lib/footnotes'
import type { FootnoteBlock } from '@/payload-types'

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
 * renders as a mark with a hover card.
 */
export const RichTextField: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  className?: string
  footnotes?: Footnote[]
  footnoteLabel?: string
}> = ({ data, className, footnotes = [], footnoteLabel = 'Note' }) => {
  if (!data) return null

  const converters: JSXConvertersFunction = ({ defaultConverters }) => ({
    ...defaultConverters,
    // A quote whose last line starts with a dash ("— Pascal", written in the
    // editor as a line break then the source) gets that line as its citation.
    quote: ({ node, nodesToJSX }) => {
      const kids = (node as { children: SerializedLexicalNode[] }).children
      let at = -1
      kids.forEach((k, i) => {
        const next = kids[i + 1] as { type?: string; text?: string } | undefined
        if (k.type === 'linebreak' && next?.type === 'text' && SOURCE_LEAD.test(next.text ?? '')) at = i
      })
      if (at === -1) return <blockquote>{nodesToJSX({ nodes: kids })}</blockquote>
      const first = kids[at + 1] as SerializedLexicalNode & { text: string }
      const source = [{ ...first, text: first.text.replace(SOURCE_LEAD, '') }, ...kids.slice(at + 2)]
      return (
        <blockquote className="quote-with-source">
          <p>{nodesToJSX({ nodes: kids.slice(0, at) })}</p>
          <footer>
            <cite>{nodesToJSX({ nodes: source })}</cite>
          </footer>
        </blockquote>
      )
    },
    inlineBlocks: {
      footnote: ({ node }: { node: SerializedInlineBlockNode<FootnoteBlock> }) => {
        const f = footnotes.find((x) => x.id === node.fields.id)
        return f ? <FootnoteMark label={footnoteLabel} note={f.note} number={f.number} /> : null
      },
    },
  })

  return (
    <RichText
      className={className ?? 'prose prose-neutral max-w-none dark:prose-invert'}
      converters={converters}
      data={data}
    />
  )
}
