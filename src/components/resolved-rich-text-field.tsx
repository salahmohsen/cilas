import type { ComponentProps } from 'react'
import { getLocale } from 'next-intl/server'
import type { Reader } from '@/lib/reader'
import { RichTextField } from '@/components/RichTextField'
import { RichTextScope } from '@/components/rich-text-scope'

export async function ResolvedRichTextField({
  user = null,
  ...props
}: ComponentProps<typeof RichTextField> & { user?: Reader }) {
  const locale = await getLocale()
  return (
    <RichTextScope data={props.data} locale={locale} user={user}>
      <RichTextField {...props} />
    </RichTextScope>
  )
}
