import { unstable_cache } from 'next/cache'
import { getPayload, type Payload } from 'payload'
import config from '@payload-config'

/** Every cached dashboard figure carries this tag; `revalidateTag` refreshes them all. */
export const STATS_TAG = 'admin-stats'

/**
 * One dashboard query, shared by every admin and kept for `seconds`. The
 * loader gets its own Payload instance (a cached function takes no live
 * objects) and reads with `overrideAccess`, so call it only after the admin
 * check in `DashboardView`. The result must be plain JSON.
 */
export const cachedStat = <T>(
  key: string,
  load: (payload: Payload) => Promise<T>,
  seconds = 60,
): Promise<T> =>
  unstable_cache(async () => load(await getPayload({ config })), ['admin-stats', key], {
    revalidate: seconds,
    tags: [STATS_TAG],
  })()
