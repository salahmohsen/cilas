'use client'

import { RichText } from '@payloadcms/richtext-lexical/react'

import { HoverCard } from '@/components/arc/hover-card/hover-card'
import type { FootnoteBlock } from '@/payload-types'

/**
 * A footnote's mark in the text: a superscript number whose hover card (a tap
 * on touch) shows the note. The mark also links to the note in the list at
 * the end, so it works without the card.
 */
export function FootnoteMark({
  number,
  note,
  url,
  label,
  sourceLabel,
}: {
  number: number
  note: FootnoteBlock['note']
  url?: string | null
  label: string
  sourceLabel: string
}) {
  return (
    <HoverCard
      content={
        <div className="footnote-card max-w-[22rem] text-sm leading-relaxed">
          <p className="mb-1 font-mono text-[0.68rem] tracking-[0.14em] text-[var(--text-muted)] uppercase rtl:tracking-normal">
            {label} {number}
          </p>
          <RichText className="[&_a]:underline [&_p]:m-0" data={note} />
          {url && <SourceLink href={url} label={sourceLabel} />}
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
        <sup>{number}</sup>
      </a>
    </HoverCard>
  )
}

/** The reference online: opens in a new tab. */
export function SourceLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      className="mt-2 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-4 hover:decoration-2"
      href={href}
      rel="noopener"
      target="_blank"
    >
      {label}
      <span aria-hidden className="rtl:-scale-x-100">↗</span>
    </a>
  )
}
