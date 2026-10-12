import type { PosterLayout } from '@/components/home/poster'

/**
 * A layout for each of `count` posters, at random, with no two neighbours
 * alike, the last and the first included, since the carousel loops. Drawn
 * on the server, so the page and its hydration agree.
 */
export const posterLayouts = (
  count: number,
  random: () => number = Math.random,
): PosterLayout[] => {
  const layouts: PosterLayout[] = []
  for (let i = 0; i < count; i++) {
    const taken = new Set([layouts[i - 1], i === count - 1 && count > 2 ? layouts[0] : undefined])
    const free = ([0, 1, 2, 3] as PosterLayout[]).filter((l) => !taken.has(l))
    layouts.push(free[Math.floor(random() * free.length)]!)
  }
  return layouts
}
