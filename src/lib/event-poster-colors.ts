import type { Event } from '@/payload-types'

export const EVENT_POSTER_COLORS = {
  talk: '#ffb71b',
  panel: '#83b8ff',
  book_discussion: '#ff7d9d',
  reading_group: '#b6a0ed',
  screening: '#12d08f',
  performance: '#ff976b',
  music: '#e4a0ef',
  exhibition: '#80d7db',
  open_day: '#d3e87c',
  workshop: '#e8c98c',
  residency: '#a6cf9d',
  visit: '#c3c7f5',
  other: '#d4d0c6',
} satisfies Record<Event['event_type'], string>
