/**
 * Asks before the page is left while work waits to be saved. This Next
 * version has no way to stop a navigation for the whole app (only `Link`'s
 * own `onNavigate`), so the guard covers what it can reach:
 *
 * - a reload, a closed tab or a link off the site: the browser's own question
 *   (`beforeunload`);
 * - a click on a link inside the site: `ask`, with the way to go on;
 * - a navigation the app starts in code (a tab switch, a Done button): the
 *   code calls `leave` with its way to go on.
 *
 * Back and Forward cannot be stopped. One guard holds at a time.
 */

/** Shows the question; calls `go` when the person chooses to leave. */
type Ask = (go: () => void) => void

let asking: Ask | null = null

/** A click that goes to another page of this site, as its URL; null for any other click. */
export const leavingHref = (event: MouseEvent): string | null => {
  if (event.defaultPrevented || event.button !== 0) return null
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return null
  const anchor = event.target instanceof Element ? event.target.closest('a') : null
  if (!anchor?.href || anchor.hasAttribute('download') || anchor.target === '_blank') return null
  const target = new URL(anchor.href)
  const here = new URL(window.location.href)
  if (target.origin !== here.origin) return null
  // The same page, or a place on it: nothing is left.
  if (target.pathname + target.search === here.pathname + here.search) return null
  return anchor.href
}

/**
 * Holds the guard until the returned function runs. `navigate` follows a
 * link the person chose to leave by, in the app's own router.
 */
export function guardLeaving({
  ask,
  navigate,
}: {
  ask: Ask
  navigate: (href: string) => void
}): () => void {
  const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()
  const onClick = (event: MouseEvent) => {
    const href = leavingHref(event)
    if (!href) return
    event.preventDefault()
    event.stopPropagation()
    ask(() => navigate(href))
  }
  window.addEventListener('beforeunload', onBeforeUnload)
  document.addEventListener('click', onClick, true)
  asking = ask
  return () => {
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('click', onClick, true)
    if (asking === ask) asking = null
  }
}

/** A navigation the app starts in code: it goes at once, or after the guard's question. */
export function leave(go: () => void): void {
  if (asking) asking(go)
  else go()
}
