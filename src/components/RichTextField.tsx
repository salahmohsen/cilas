import { RichText } from '@payloadcms/richtext-lexical/react'
import React from 'react'

/**
 * Renders Lexical rich text through Payload's own converters, so the frontend
 * emits the same structure the admin editor produces — headings, lists, quotes,
 * links, uploads — instead of flattening to plain text.
 *
 * Styling is Tailwind Typography's `prose`, which is what shadcn uses for
 * rendered rich text. Payload's admin stylesheet cannot be reused here: its
 * prose rules live in `@layer payload-default` and depend on the admin's
 * `--theme-*` custom properties.
 */
export const RichTextField: React.FC<{
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  className?: string
}> = ({ data, className }) => {
  if (!data) return null

  return <RichText className={className ?? 'prose prose-neutral max-w-none dark:prose-invert'} data={data} />
}
