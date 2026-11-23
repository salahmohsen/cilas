const FOCUS_INTERVAL_MS = 30_000

export function subscribeFocusRefresh(refresh: () => void, ready?: () => boolean): () => void {
  let lastRefresh = -Infinity
  const onFocus = () => {
    const now = performance.now()
    if (now - lastRefresh < FOCUS_INTERVAL_MS || ready?.() === false) return
    lastRefresh = now
    refresh()
  }
  window.addEventListener('focus', onFocus)
  return () => window.removeEventListener('focus', onFocus)
}
