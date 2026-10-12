import { Flower2, Leaf, Snowflake, Sun, type LucideIcon } from 'lucide-react'

import type { Season } from '@/lib/cycle'

/** A season's mark: the one picture the site gives a cycle. */
export const SEASON_ICONS: Record<Season, LucideIcon> = {
  spring: Flower2,
  summer: Sun,
  fall: Leaf,
  winter: Snowflake,
}
