import { render, type RenderOptions } from '@testing-library/react'
import {
  AppRouterContext,
  type AppRouterInstance,
  type NavigateOptions,
} from 'next/dist/shared/lib/app-router-context.shared-runtime'
import {
  PathnameContext,
  SearchParamsContext,
} from 'next/dist/shared/lib/hooks-client-context.shared-runtime'
import { useMemo, useSyncExternalStore, type ReactNode } from 'react'

type Visit = { method: 'push' | 'replace'; href: string; options?: NavigateOptions }

/**
 * An app router held in memory. It moves its URL the way the browser does
 * on `push`, `replace`, `back` and `forward`, and keeps every visit and
 * refresh so a test can assert where the code sent the person.
 */
export const createMemoryRouter = (start = '/') => {
  const entries = [new URL(start, 'http://localhost:3000')]
  let index = 0
  const visits: Visit[] = []
  let refreshes = 0
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const go = (method: Visit['method'], href: string, options?: NavigateOptions) => {
    visits.push({ method, href, options })
    const next = new URL(href, entries[index])
    if (method === 'push') {
      entries.splice(index + 1, entries.length, next)
      index += 1
    } else {
      entries[index] = next
    }
    notify()
  }
  const router = {
    back: () => {
      index = Math.max(0, index - 1)
      notify()
    },
    forward: () => {
      index = Math.min(entries.length - 1, index + 1)
      notify()
    },
    refresh: () => {
      refreshes += 1
      notify()
    },
    push: (href, options) => go('push', href, options),
    replace: (href, options) => go('replace', href, options),
    prefetch: () => {},
    bfcacheId: 'test',
  } satisfies AppRouterInstance
  return {
    router,
    get url() {
      return entries[index]!
    },
    get visits() {
      return [...visits]
    },
    get refreshes() {
      return refreshes
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export type MemoryRouter = ReturnType<typeof createMemoryRouter>

/** Next's own router, pathname and search params contexts, fed by `memory`. */
export function NavigationProvider({
  memory,
  children,
}: {
  memory: MemoryRouter
  children: ReactNode
}) {
  const href = useSyncExternalStore(
    memory.subscribe,
    () => memory.url.href,
    () => memory.url.href,
  )
  const url = useMemo(() => new URL(href), [href])
  return (
    <AppRouterContext.Provider value={memory.router}>
      <PathnameContext.Provider value={url.pathname}>
        <SearchParamsContext.Provider value={url.searchParams}>
          {children}
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  )
}

/**
 * `render` under `NavigationProvider`, so `useRouter`, `usePathname` and
 * `useSearchParams` from `next/navigation` are the real hooks. Returns the
 * render result and the memory router to assert on.
 */
export const renderWithNavigation = (
  ui: ReactNode,
  { url = '/', ...options }: RenderOptions & { url?: string } = {},
) => {
  const memory = createMemoryRouter(url)
  const result = render(ui, {
    wrapper: ({ children }) => <NavigationProvider memory={memory}>{children}</NavigationProvider>,
    ...options,
  })
  return { ...result, memory }
}
