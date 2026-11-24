import { NeedList } from '@/portal/needs/need-list'
import type { NeedsResult } from '@/portal/needs/sources'

export function NeedsCard({ result }: { result: NeedsResult }) {
  return <NeedList result={result} group={result.rows.length > 5} />
}
