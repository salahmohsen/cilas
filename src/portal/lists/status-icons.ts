import {
  ArchiveRestore,
  ArchiveX,
  CircleX,
  Clock,
  FileClock,
  FilePen,
  Globe,
  MessageSquareWarning,
  PencilLine,
  type LucideIcon,
} from 'lucide-react'

import type { StatusIcon } from '@/lib/review-status'

/** The lucide icon of each status badge. Here, not in src/lib, because src/lib imports no UI. */
export const STATUS_ICONS: Record<StatusIcon, LucideIcon> = {
  'pencil-line': PencilLine,
  clock: Clock,
  'message-square-warning': MessageSquareWarning,
  'circle-x': CircleX,
  globe: Globe,
  'file-pen': FilePen,
  'file-clock': FileClock,
  'archive-x': ArchiveX,
  'archive-restore': ArchiveRestore,
}
