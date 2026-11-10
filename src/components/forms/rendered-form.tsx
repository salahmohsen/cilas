import type { ComponentProps, ReactNode } from 'react'

import { PayloadForm } from '@/components/forms/payload-form'
import { ResolvedRichTextField as RichTextField } from '@/components/resolved-rich-text-field'
import { publicForm } from '@/forms/public-form'

export function RenderedForm({
  form,
  ...props
}: Omit<ComponentProps<typeof PayloadForm>, 'notes' | 'confirmation'>) {
  const notes: Record<string, ReactNode> = {}
  for (const block of form.fields ?? []) {
    if (block.blockType === 'message' && block.message && block.id) {
      notes[block.id] = <RichTextField className="article-prose" data={block.message} />
    }
  }
  const confirmation = form.confirmationMessage ? (
    <RichTextField className="article-prose" data={form.confirmationMessage} />
  ) : null

  return (
    <PayloadForm {...props} confirmation={confirmation} form={publicForm(form)} notes={notes} />
  )
}
