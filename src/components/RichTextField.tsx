import type { SerializedInlineBlockNode } from '@payloadcms/richtext-lexical'
import { RichText, type JSXConvertersFunction } from '@payloadcms/richtext-lexical/react'
import React from 'react'

import { FootnoteMark } from '@/components/article/footnote'
import type { Footnote } from '@/lib/footnotes'
import type { FootnoteBlock } from '@/payload-types'

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
