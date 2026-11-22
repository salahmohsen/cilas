/**
 * The task reads start this long after the first call, so the shell's first byte goes out first.
 * The shell and the reads share one thread: an admin's reads cost 10 to 18 ms of CPU, and without
 * a head start they land before the flush. Measured on the Mac (portal phase 1c-2, admin
 * `/en/spaces` TTFB p75 above `main`, 5 interleaved rounds): 0 ms +7, 10 ms +3, 40 ms +1 (noise).
 * A fixed delay is the only handle: `setImmediate` gave no gain, and a page cannot tell when the layout flushed.
 */
export const TASK_READS_HEAD_START_MS = 40

/** Runs `read` once the head start has passed. */
export const afterHeadStart = async <Value>(read: () => Promise<Value>) => {
  await new Promise((resolve) => setTimeout(resolve, TASK_READS_HEAD_START_MS))
  return read()
}
