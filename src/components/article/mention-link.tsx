'use client'

import { HoverCard, HoverCardProfile } from '@/components/arc/hover-card/hover-card'
import { Link } from '@/i18n/navigation'

import type { MentionPreview } from '@/lib/mentions'

/**
 * A mention in an article's text: a real link (crawlers and keyboards follow
 * it like any other) whose hover card, built only when it opens, previews
 * what it points to. On touch a tap follows the link.
 */
export function MentionLink({
  label,
  href,
  preview,
  kindLabel,
}: {
  label: string
  href: string
  preview: MentionPreview
  /** The preview's small first line: "Course", "Article"… in the page's language. */
  kindLabel: string
}) {
  const content =
    preview.kind === 'person' ? (
      <HoverCardProfile
        avatar={preview.image ?? undefined}
        bio={preview.text ?? undefined}
        name={preview.title}
        role={kindLabel}
      />
    ) : (
      <div className="grid max-w-[20rem] gap-2 text-sm leading-relaxed">
        {preview.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="aspect-[4/3] w-full rounded-md object-cover"
            decoding="async"
            src={preview.image}
          />
        ) : null}
        <p className="text-xs text-(--text-secondary)">
          {[kindLabel, preview.meta].filter(Boolean).join(' · ')}
        </p>
        <p className="font-medium text-(--foreground)" dir="auto">
          {preview.title}
        </p>
        {preview.text ? (
          <p className="line-clamp-3 text-(--text-secondary)" dir="auto">
            {preview.text}
          </p>
        ) : null}
      </div>
    )
  return (
    <HoverCard content={content} side="top">
      <Link className="article-mention" href={href}>
        {label}
      </Link>
    </HoverCard>
  )
}
