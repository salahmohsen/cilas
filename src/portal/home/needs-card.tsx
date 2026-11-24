import { NeedList } from '@/portal/needs/need-list'
import type { NeedsResult } from '@/portal/needs/sources'

/** Past this many rows, Needs you groups them by kind. */
const GROUP_ABOVE = 5

export function NeedsCard({ result }: { result: NeedsResult }) {
  return <NeedList result={result} group={result.rows.length > GROUP_ABOVE} />
}
