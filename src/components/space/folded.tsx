import { ExpandableText } from '@/components/arc/expandable-text/expandable-text'

/**
 * Arc's expandable text starts folded until it measures in the browser, so a
 * short body would flash a "Read more". Only a body that can pass the clamp
 * (about 90 characters a line, or one line per break) gets the fold.
 */
export const Folded = ({
  body,
  lines,
  more,
  less,
  children,
}: {
  body: string
  lines: number
  more: string
  less: string
  children: React.ReactNode
}) =>
  body.length > lines * 90 || body.split('\n').length > lines ? (
    <ExpandableText lines={lines} moreLabel={more} lessLabel={less}>
      {children}
    </ExpandableText>
  ) : (
    children
  )
