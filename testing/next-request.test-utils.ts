import { workAsyncStorage } from 'next/dist/server/app-render/work-async-storage.external'
import { workUnitAsyncStorage } from 'next/dist/server/app-render/work-unit-async-storage.external'
import { createRequestStoreForAPI } from 'next/dist/server/async-storage/request-store'
import { createWorkStore } from 'next/dist/server/async-storage/work-store'
import { defaultConfig } from 'next/dist/server/config-shared'
import { IncrementalCache } from 'next/dist/server/lib/incremental-cache'
import { getImplicitTags } from 'next/dist/server/lib/implicit-tags'
import { NextRequest } from 'next/server'

const previewProps = {
  previewModeId: 'test-preview-id',
  previewModeSigningKey: 'test-preview-signing-key',
  previewModeEncryptionKey: 'test-preview-encryption-key',
}

const cacheLifeProfiles = {
  ...defaultConfig.cacheLife,
  default: {
    ...defaultConfig.cacheLife.default,
    stale: defaultConfig.experimental.staleTimes?.static ?? 300,
  },
}

type RequestOptions = {
  headers?: HeadersInit
  page?: string
  url?: string
}

/**
 * Runs `work` inside the request scope Next gives a server action: a real
 * work store and request store, so the real `headers()`, `cookies()`,
 * `revalidatePath`, `revalidateTag`, `updateTag` and `unstable_cache` work.
 * Returns what `work` returned and the cache tags it revalidated, in Next's
 * form (`revalidatePath('/x')` is the tag `_N_T_/x`). It then closes the
 * request as a host would, so `after()` callbacks run before it returns.
 */
export const runInRequest = async <Result>(
  work: () => Promise<Result>,
  { headers, page = '/[locale]/page', url = 'http://localhost:3000/' }: RequestOptions = {},
) => {
  const incrementalCache = new IncrementalCache({
    dev: true,
    requestHeaders: {},
    previewProps,
    prerenderManifest: {
      version: 4,
      routes: {},
      dynamicRoutes: {},
      notFoundRoutes: [],
      preview: previewProps,
    },
  })
  const onClose: (() => void)[] = []
  const pending: Promise<unknown>[] = []
  const workStore = createWorkStore({
    page,
    renderOpts: {
      incrementalCache,
      cacheLifeProfiles,
      staticPageGenerationTimeout: defaultConfig.staticPageGenerationTimeout,
      cacheComponents: false,
      validationLevel: 'warning',
      experimental: {
        authInterrupts: false,
        useCacheTimeout: defaultConfig.staticPageGenerationTimeout * 0.9,
        durableUseCacheEntries: false,
      },
      waitUntil: (promise) => {
        pending.push(promise)
      },
      onClose: (callback) => {
        onClose.push(callback)
      },
      onAfterTaskError: undefined,
    },
    buildId: 'test',
    deploymentId: 'test',
    previouslyRevalidatedTags: [],
  })
  const request = new NextRequest(url, { headers })
  const requestStore = createRequestStoreForAPI(
    request,
    request.nextUrl,
    await getImplicitTags(page, request.nextUrl.pathname, null),
    undefined,
    previewProps,
    undefined,
  )
  const result = await workAsyncStorage.run(workStore, () =>
    workUnitAsyncStorage.run(requestStore, work),
  )
  for (const close of onClose) close()
  await Promise.all(pending)
  return {
    result,
    revalidated: (workStore.pendingRevalidatedTags ?? []).map(({ tag }) => tag),
  }
}
