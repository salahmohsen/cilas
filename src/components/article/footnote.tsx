'use client'

import { RichText } from '@payloadcms/richtext-lexical/react'
import type { SerializedInlineBlockNode } from '@payloadcms/richtext-lexical'

import { HoverCard } from '@/components/arc/hover-card/hover-card'
import type { FootnoteBlock, MentionBlock } from '@/payload-types'
import { ReferenceMention } from '@/components/rich-text-references'
import { RichTextNodeLink } from '@/components/rich-text-node-link'

/**
 * A footnote's mark in the text: a superscript number whose hover card (a tap
 * on touch) shows the note. The mark also links to the note in the list at
 * the end, so it works without the card.
 */
export function FootnoteMark({
  number,
  shown,
  note,
  label,
}: {
  number: number
  /** The number as the text's language writes it. */
  shown: string
  note: FootnoteBlock['note']
  label: string
}) {
  return (
    <HoverCard
      content={
        <div className="footnote-card max-w-[22rem] text-sm leading-relaxed">
          <p className="mb-1 font-mono text-[0.68rem] tracking-[0.14em] text-[var(--text-muted)] uppercase rtl:tracking-normal">
            {label} {shown}
          </p>
          <RichText
            className="[&_a]:underline [&_a]:underline-offset-2 [&_p]:m-0"
            data={note}
            converters={({ defaultConverters }) => ({
              ...defaultConverters,
              link: ({ node, nodesToJSX }) => (
                <RichTextNodeLink fields={node.fields}>
                  {nodesToJSX({ nodes: node.children })}
                </RichTextNodeLink>
              ),
              inlineBlocks: {
                mention: ({ node }: { node: SerializedInlineBlockNode<MentionBlock> }) => (
                  <ReferenceMention fields={node.fields as unknown as Record<string, unknown>} />
                ),
              },
            })}
          />
        </div>
      }
      side="top"
    >
      <a
        aria-describedby={`fn-${number}`}
        className="footnote-mark"
        href={`#fn-${number}`}
        id={`fnref-${number}`}
      >
        <sup>{shown}</sup>
      </a>
    </HoverCard>
  )
}
