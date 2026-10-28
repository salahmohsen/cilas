'use client'

import { useMemo, useState } from 'react'

/** Both tabs store unchecked facet IDs. Refreshing permissions clears data,
 * while freshly authorized options for the same account retain filter intent. */
export function useSearchFilters(owner: string | null, ids: string[]) {
  const [state, setState] = useState<{ owner: string | null; hidden: ReadonlySet<string> }>({
    owner,
    hidden: new Set(),
  })
  if (owner !== null && state.owner !== owner) setState({ owner, hidden: new Set() })
  const available = JSON.stringify(ids)
  const hidden = useMemo(() => {
    const allowed = new Set<string>(JSON.parse(available))
    return new Set(owner === state.owner ? [...state.hidden].filter((id) => allowed.has(id)) : [])
  }, [available, owner, state])
  return {
    hidden,
    toggle: (id: string) =>
      setState((previous) => {
        const allowed = new Set<string>(JSON.parse(available))
        const next = new Set(
          previous.owner === owner
            ? [...previous.hidden].filter((value) => allowed.has(value))
            : [],
        )
        if (!next.delete(id)) next.add(id)
        return { owner, hidden: next }
      }),
    clear: () => setState({ owner, hidden: new Set() }),
  }
}
