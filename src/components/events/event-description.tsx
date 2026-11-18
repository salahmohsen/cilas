import type { Event } from '@/payload-types'
import { ResolvedRichTextField } from '@/components/resolved-rich-text-field'

import { eventDescriptionField } from './event-description-field'

export function EventDescription({ data }: { data: NonNullable<Event['description']> }) {
  return <ResolvedRichTextField {...eventDescriptionField(data)} />
}
