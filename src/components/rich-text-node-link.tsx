import type { ReactNode } from 'react'
import type { SerializedLinkNode } from '@payloadcms/richtext-lexical'
import { ReferenceLink } from '@/components/rich-text-references'

export function RichTextNodeLink({
  fields,
  children,
}: {
  fields: SerializedLinkNode['fields']
  children: ReactNode
}) {
  if (fields.linkType === 'internal') {
    return (
      <ReferenceLink
        collection={fields.doc?.relationTo ?? ''}
        value={fields.doc?.value}
        newTab={fields.newTab}
      >
        {children}
      </ReferenceLink>
    )
  }
  return (
    <a
      href={fields.url}
      target={fields.newTab ? '_blank' : undefined}
      rel={fields.newTab ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  )
}
