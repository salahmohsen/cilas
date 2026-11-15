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
 * Back and Forward cannot be stopped. The newest guard asks.
 */

/** Shows the question; calls `go` when the person chooses to leave. */
type Ask = (go: () => void) => void

type Guard = { ask: Ask; navigate: (href: string) => void }

/** The guards held now; the last one asks. A form inside an editor guards over it. */
const guards: Guard[] = []

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

const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault()

const onClick = (event: MouseEvent) => {
  const guard = guards.at(-1)
  const href = guard && leavingHref(event)
  if (!guard || !href) return
  event.preventDefault()
  event.stopPropagation()
  guard.ask(() => guard.navigate(href))
}

/**
 * Holds the guard until the returned function runs. `navigate` follows a
 * link the person chose to leave by, in the app's own router. A guard taken
 * while another holds asks first; its release gives the question back.
 */
export function guardLeaving(guard: Guard): () => void {
  const entry = { ...guard }
  if (guards.length === 0) {
    window.addEventListener('beforeunload', onBeforeUnload)
    document.addEventListener('click', onClick, true)
  }
  guards.push(entry)
  return () => {
    const at = guards.indexOf(entry)
    if (at === -1) return
    guards.splice(at, 1)
    if (guards.length > 0) return
    window.removeEventListener('beforeunload', onBeforeUnload)
    document.removeEventListener('click', onClick, true)
  }
}

/** A navigation the app starts in code: it goes at once, or after the guard's question. */
export function leave(go: () => void): void {
  const guard = guards.at(-1)
  if (guard) guard.ask(go)
  else go()
}
