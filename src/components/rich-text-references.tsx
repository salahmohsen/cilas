'use client'

import { MENTION_TYPES } from '@/blocks/mention'
import { BlogCardBody } from '@/components/arc/blocks/blog-grid/blog-grid'
import blogStyles from '@/components/arc/blocks/blog-grid/blog-grid.module.css'
import { MentionLink } from '@/components/article/mention-link'
import { Link } from '@/i18n/navigation'
import type { ResolvedMention } from '@/lib/mentions'
import { referenceKey, type RichTextReferences } from '@/lib/rich-text-references'
import { useTranslations } from 'next-intl'
import { createContext, useContext, type ReactNode } from 'react'

const References = createContext<RichTextReferences>({})

export function RichTextReferencesProvider({
  references,
  children,
}: {
  references: RichTextReferences
  children: ReactNode
}) {
  return <References.Provider value={references}>{children}</References.Provider>
}

export function ReferenceMention({
  fields,
  plain = false,
}: {
  fields: Record<string, unknown>
  plain?: boolean
}) {
  const references = useContext(References)
  const type = MENTION_TYPES.find((t) => t.value === fields.type)
  const resolved = type ? references[referenceKey(type.relationTo, fields[type.value])] : undefined
  const label = String(fields.label ?? '')
  return resolved && !plain ? <MentionWithLabel resolved={resolved} label={label} /> : <>{label}</>
}

function MentionWithLabel({ resolved, label }: { resolved: ResolvedMention; label: string }) {
  const t = useTranslations('Article')
  return (
    <MentionLink
      {...resolved}
      label={label}
      kindLabel={t(`mentionKinds.${resolved.preview.kind}`)}
    />
  )
}

export function ReferenceLink({
  collection,
  value,
  children,
  newTab = false,
}: {
  collection: string
  value: unknown
  children: ReactNode
  newTab?: boolean
}) {
  const resolved = useContext(References)[referenceKey(collection, value)]
  return resolved ? (
    <Link
      href={resolved.href}
      target={newTab ? '_blank' : undefined}
      rel={newTab ? 'noopener noreferrer' : undefined}
    >
      {children}
    </Link>
  ) : (
    <>{children}</>
  )
}

export function RelatedReference({ collection, value }: { collection: string; value: unknown }) {
  const resolved = useContext(References)[referenceKey(collection, value)]
  return resolved ? <RelatedSummary resolved={resolved} /> : null
}

function RelatedSummary({ resolved }: { resolved: ResolvedMention }) {
  const t = useTranslations('Article')
  const { preview, href } = resolved
  const byline = ['article', 'course', 'publication'].includes(preview.kind)
  return (
    <aside className="not-prose my-6" style={{ container: 'blog / inline-size' }}>
      <Link
        href={href}
        className={blogStyles.featured}
        data-image-sizing="content"
        data-has-image={Boolean(preview.image)}
      >
        <BlogCardBody
          featured
          imageSizing="content"
          post={{
            id: href,
            title: preview.title,
            excerpt: [!byline && preview.meta, preview.text].filter(Boolean).join(' · '),
            category: t(`mentionKinds.${preview.kind}`),
            date: '',
            dateLabel: '',
            readTime: 0,
            readTimeLabel: '',
            author: { name: byline ? (preview.meta ?? '') : '' },
            image: preview.image ? { src: preview.image, alt: '' } : undefined,
          }}
        />
      </Link>
    </aside>
  )
}
