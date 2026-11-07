/** The wait after `delay` when a retry fails again: doubled, up to `cap` (milliseconds). */
export const backoff = (delay: number, cap: number): number => Math.min(delay * 2, cap)
