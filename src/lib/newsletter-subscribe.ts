/**
 * Adds an address to the newsletter (src/app/(frontend)/api/newsletter).
 * Throws on failure, which the Arc forms show as their error state.
 */
export const subscribeToNewsletter = async (email: string) => {
  const res = await fetch('/api/newsletter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!res.ok) throw new Error((await res.json().catch(() => null))?.error ?? 'Subscribe failed')
}
