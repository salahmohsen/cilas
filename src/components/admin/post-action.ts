import { toast } from '@payloadcms/ui'

/**
 * POSTs to an admin action route as the signed-in user. A failure shows the
 * route's `error` as a toast, or `failed` when the route said nothing.
 */
export async function postAction<T extends object>(
  url: string,
  failed: string,
): Promise<{ ok: boolean; body: (T & { error?: string }) | null }> {
  const res = await fetch(url, { method: 'POST', credentials: 'include' }).catch(() => null)
  const body = (await res?.json().catch(() => null)) as (T & { error?: string }) | null
  const ok = Boolean(res?.ok)
  if (!ok) toast.error(body?.error ?? failed)
  return { ok, body }
}
