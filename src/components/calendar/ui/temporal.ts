import { Temporal as Polyfill } from 'temporal-polyfill'

/**
 * `Temporal` where the runtime has it (Node 26, Chrome 144, Firefox 139),
 * else the polyfill. The `import()` keeps the polyfill out of the main
 * bundle: only a runtime without `Temporal` fetches its chunk. Production
 * runs Node 22, so the server loads it there.
 */
export const Temporal: typeof Polyfill =
  (globalThis as { Temporal?: typeof Polyfill }).Temporal ??
  (await import('temporal-polyfill')).Temporal

export type { Polyfill as TemporalNamespace }
