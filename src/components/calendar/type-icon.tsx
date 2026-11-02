import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  Clapperboard,
  DoorOpen,
  Drama,
  FlaskConical,
  Frame,
  Hammer,
  Landmark,
  Layers,
  MapPin,
  Mic,
  Music,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/** One icon per kind of course or event, for the calendar's rows (colours are in `toneOf`). */
const TYPE_ICONS: Record<string, LucideIcon> = {
  core: Landmark,
  thematic: Layers,
  lab: FlaskConical,
  workshop: Hammer,
  short: Zap,
  talk: Mic,
  panel: Users,
  book_discussion: BookOpen,
  reading_group: BookOpenText,
  screening: Clapperboard,
  performance: Drama,
  music: Music,
  exhibition: Frame,
  open_day: DoorOpen,
  residency: Landmark,
  visit: MapPin,
}

export function TypeIcon({ type }: { type: string }) {
  const Icon = TYPE_ICONS[type] ?? CalendarDays
  return <Icon aria-hidden size={16} strokeWidth={1.5} />
}
