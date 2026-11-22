import {
  AtSign,
  CalendarClock,
  CircleCheck,
  CircleX,
  FileSearch,
  Flag,
  Heart,
  Megaphone,
  MessageCircle,
  PenLine,
  Reply,
  Shield,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import type { ReactNode } from 'react'

import type { NotificationIcon } from '@/lib/notification-kinds'

/** The glyph of each notification icon key. No `'use client'`: the bell and the server-rendered Latest rows both read it. */
export const NOTIFICATION_GLYPHS: Record<NotificationIcon, ReactNode> = {
  'file-search': <FileSearch size={18} strokeWidth={1.7} />,
  'circle-check': <CircleCheck size={18} strokeWidth={1.7} />,
  'pen-line': <PenLine size={18} strokeWidth={1.7} />,
  'circle-x': <CircleX size={18} strokeWidth={1.7} />,
  trash: <Trash2 size={18} strokeWidth={1.7} />,
  'user-plus': <UserPlus size={18} strokeWidth={1.7} />,
  'at-sign': <AtSign size={18} strokeWidth={1.7} />,
  'message-circle': <MessageCircle size={18} strokeWidth={1.7} />,
  reply: <Reply size={18} strokeWidth={1.7} />,
  heart: <Heart size={18} strokeWidth={1.7} />,
  megaphone: <Megaphone size={18} strokeWidth={1.7} />,
  shield: <Shield size={18} strokeWidth={1.7} />,
  flag: <Flag size={18} strokeWidth={1.7} />,
  'calendar-clock': <CalendarClock size={18} strokeWidth={1.7} />,
  'user-check': <UserCheck size={18} strokeWidth={1.7} />,
}
