import { describe, expect, it } from 'vitest'
import { mergePublicEditItems } from './public-items'
import type { CalendarItem } from '../../lib/calendar-items'

const item = (id: string, sessionId?: string, cancelled = false): CalendarItem => ({
  id,
  sessionId,
  cancelled,
  kind: 'session',
  title: id,
  tone: 'blue',
  version: '',
  blocks: [],
})

describe('public edit items', () => {
  it('drops a feed twin', () => {
    const edit = item('1', '1')
    expect(mergePublicEditItems([edit], [item('s1', '1')])).toEqual([edit])
  })
  it('keeps other sessions and events', () => {
    const feed = [item('s2', '2'), item('event')]
    expect(mergePublicEditItems([item('1', '1')], feed).slice(1)).toEqual(feed)
  })
  it('keeps cancelled meetings', () => {
    const cancelled = item('s1-cancelled', '1', true)
    expect(mergePublicEditItems([item('1', '1')], [cancelled])).toContain(cancelled)
  })
})
