'use client'

import { Suspense, use, type ComponentType, type ReactNode } from 'react'

/**
 * A client component in its own chunk, fetched on demand.
 *
 * Rule: use it only for UI that appears after a user action (dialogs, sheets,
 * lightboxes, editors, panels). Never for first-render content, which must be
 * in the server-rendered HTML, and never for a server component. Mount it only
 * once the action happened, so it does not render on the server.
 *
 * `load` resolves to the component itself, so a named export needs no wrapper:
 * `preloadable(() => import('./panel').then((m) => m.Panel))`.
 *
 * Call `X.preload()` from the trigger's `onPointerEnter`, `onFocus` and
 * `onPointerDown` to have the chunk ready before the click. It ignores its
 * arguments, so a handler may take it as is, and it never rejects. A failed
 * import is not kept: the next `preload()` or render tries again. The component
 * has its own `<Suspense>`, so a first render never suspends a parent boundary.
 */
export function preloadable<P extends object>(
  load: () => Promise<ComponentType<P>>,
  { fallback = null, name = 'Lazy' }: { fallback?: ReactNode; name?: string } = {},
) {
  let loaded: ComponentType<P> | undefined
  let pending: Promise<ComponentType<P>> | undefined

  const start = () =>
    (pending ??= load().then(
      (component) => (loaded = component),
      (error: unknown) => {
        pending = undefined
        throw error
      },
    ))

  function Inner(props: P) {
    const Loaded = loaded ?? use(start())
    return <Loaded {...props} />
  }

  function Component(props: P) {
    return (
      <Suspense fallback={fallback}>
        <Inner {...props} />
      </Suspense>
    )
  }
  Component.displayName = `Preloadable(${name})`

  return Object.assign(Component, {
    preload: (..._ignored: unknown[]): void => {
      start().catch(() => {})
    },
  })
}
