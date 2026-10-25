import { splitAddresses } from '@/lib/link-title'

import { TitledLink } from './titled-link'

/** Plain comment text with each bare address shown as its page title. */
export const LinkedText = ({ text, titles }: { text: string; titles?: Record<string, string> }) => (
  <>
    {splitAddresses(text).map((part, i) =>
      typeof part === 'string' ? (
        part
      ) : (
        <span key={i}>
          <TitledLink url={part.url} titles={titles} />
          {part.tail}
        </span>
      ),
    )}
  </>
)
