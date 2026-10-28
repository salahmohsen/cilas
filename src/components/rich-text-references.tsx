'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { MentionLink } from '@/components/article/mention-link'
import { MENTION_TYPES } from '@/blocks/mention'
import { referenceKey, type RichTextReferences } from '@/lib/rich-text-references'
import type { ResolvedMention } from '@/api/mentions.api'

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

function ReferenceKind({ kind }: { kind: ResolvedMention['preview']['kind'] }) {
  const t = useTranslations('Article')
  return <>{t(`mentionKinds.${kind}`)}</>
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
  if (!resolved) return null
  const { preview, href } = resolved
  return (
    <aside className="not-prose my-6 rounded-lg border border-(--border)" dir="auto">
      <Link href={href} className="flex gap-4 p-4 text-inherit no-underline">
        {preview.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview.image}
            alt=""
            loading="lazy"
            className="h-20 w-20 shrink-0 rounded-md object-cover sm:h-24 sm:w-24"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-xs text-(--text-secondary)">
            <ReferenceKind kind={preview.kind} />
          </p>
          <p className="mt-1 font-medium">{preview.title}</p>
          {preview.meta ? (
            <p className="mt-1 text-xs text-(--text-secondary)">{preview.meta}</p>
          ) : null}
          {preview.text ? (
            <p className="mt-2 line-clamp-3 text-sm text-(--text-secondary)">{preview.text}</p>
          ) : null}
        </div>
      </Link>
    </aside>
  )
}
