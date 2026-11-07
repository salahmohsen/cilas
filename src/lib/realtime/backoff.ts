export const backoff = (delay: number, cap: number): number => Math.min(delay * 2, cap)
