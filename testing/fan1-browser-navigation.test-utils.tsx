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

type Entries = EventTarget

const entriesOf = () => (window as unknown as { navigation: Entries }).navigation

const subscribe = (change: () => void) => {
  const entries = entriesOf()
  entries.addEventListener('currententrychange', change)
  window.addEventListener('popstate', change)
  return () => {
    entries.removeEventListener('currententrychange', change)
    window.removeEventListener('popstate', change)
  }
}

/**
 * The browser's own address and history, shown to Next's hooks. Code that writes the
 * URL with `history.pushState` (which Next folds into its router) moves
 * `usePathname` and `useSearchParams` here as it does in Next, through the
 * Navigation API's `currententrychange`. `push` and `replace` on the router are
 * recorded and do not leave the page; `refresh` is counted.
 */
export const createBrowserRouter = () => {
  const visits: Visit[] = []
  let refreshes = 0
  const router = {
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    refresh: () => {
      refreshes += 1
    },
    push: (href, options) => void visits.push({ method: 'push', href, options }),
    replace: (href, options) => void visits.push({ method: 'replace', href, options }),
    prefetch: () => {},
    bfcacheId: 'test',
  } satisfies AppRouterInstance
  return {
    router,
    get visits() {
      return [...visits]
    },
    get refreshes() {
      return refreshes
    },
  }
}

export type BrowserRouter = ReturnType<typeof createBrowserRouter>

export function BrowserNavigation({
  browser,
  children,
}: {
  browser: BrowserRouter
  children: ReactNode
}) {
  const href = useSyncExternalStore(
    subscribe,
    () => window.location.href,
    () => window.location.href,
  )
  const url = useMemo(() => new URL(href), [href])
  return (
    <AppRouterContext.Provider value={browser.router}>
      <PathnameContext.Provider value={url.pathname}>
        <SearchParamsContext.Provider value={url.searchParams}>
          {children}
        </SearchParamsContext.Provider>
      </PathnameContext.Provider>
    </AppRouterContext.Provider>
  )
}

/** `render` under `BrowserNavigation`; returns the render result and the router to assert on. */
export const renderWithBrowserNavigation = (ui: ReactNode, options: RenderOptions = {}) => {
  const browser = createBrowserRouter()
  const result = render(ui, {
    wrapper: ({ children }) => <BrowserNavigation browser={browser}>{children}</BrowserNavigation>,
    ...options,
  })
  return { ...result, browser }
}
