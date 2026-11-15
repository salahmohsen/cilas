// @vitest-environment jsdom
import { act, renderHook, waitFor } from '@testing-library/react'
import { readFile } from 'node:fs/promises'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import { scheduleOffers } from '@/actions/schedule-offers'
import { calendarAdminText } from '@/components/admin/calendar-admin-text'
import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import { useScheduleSave } from '@/components/space/use-schedule-save'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import type { ScheduleOffer } from '@/lib/schedule-offer'

import en from '../../messages/en.json'

vi.mock('@/actions/save-calendar-changes', () => ({ saveCalendarChanges: vi.fn() }))
vi.mock('@/actions/schedule-offers', () => ({ scheduleOffers: vi.fn() }))

const { save: text } = calendarAdminText('en', en)

const session = (start: string): CalendarItem => ({
  id: '3',
  kind: 'session',
  title: 'Week 3',
  tone: 'yellow',
  cancelled: false,
  version: 'v1',
  blocks: [{ id: 'a', date: '2034-10-05', start_time: start, end_time: '21:00' }],
})
const event: CalendarItem = {
  id: 'space-event:9',
  kind: 'space-event',
  title: 'Talk',
  tone: 'neutral',
  readOnly: true,
  cancelled: false,
  version: 'v1',
  blocks: [{ id: '9', date: '2034-10-06', start_time: '17:00', end_time: '18:00' }],
}
const change: CalendarChange = {
  op: 'move-block',
  itemId: '3',
  version: 'v1',
  blockId: 'a',
  date: '2034-10-05',
  start_time: '20:00',
  end_time: '21:00',
}
const offer: ScheduleOffer = {
  space: { id: 1, name: 'Probe space' },
  language: 'en',
  text: '- Week 3 moves',
  block: null,
  preview: null,
}

const hook = (parent: { kind: string; id: string }, reload = vi.fn()) =>
  renderHook(() =>
    useScheduleSave({ parent, courseId: '5', locale: 'en', language: 'en', text, reload }),
  )

beforeEach(() => {
  vi.mocked(saveCalendarChanges).mockReset()
  vi.mocked(scheduleOffers).mockReset().mockResolvedValue([offer])
})

describe('useScheduleSave, the one save-then-offer of every host', () => {
  for (const parent of [
    { kind: 'course', id: '5' },
    { kind: 'space', id: '7' },
  ])
    it(`saves on the ${parent.kind} parent, then offers on the items that can change`, async () => {
      const after = [session('20:00'), { ...event, title: 'Talk, renamed' }]
      vi.mocked(saveCalendarChanges).mockResolvedValue({ ok: true, items: after })
      const { result } = hook(parent)
      let saved: CalendarItem[] = []
      await act(async () => {
        saved = await result.current.save([change], [session('19:00'), event], () => null)
      })
      expect(saved).toBe(after)
      expect(saveCalendarChanges).toHaveBeenCalledWith({ parent, changes: [change] }, 'en')
      // A readOnly item never counts as a schedule change, whatever came back.
      expect(scheduleOffers).toHaveBeenCalledWith(
        { courseId: '5', before: [session('19:00')], after: [session('20:00')] },
        'en',
      )
      await waitFor(() => expect(result.current.dialog).not.toBeNull())
    })

  it('offers nothing when nothing counts', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({ ok: true, items: [session('19:00')] })
    vi.mocked(scheduleOffers).mockResolvedValue([])
    const { result } = hook({ kind: 'space', id: '7' })
    await act(() => result.current.save([change], [session('19:00')], () => null))
    await waitFor(() => expect(scheduleOffers).toHaveBeenCalled())
    expect(result.current.dialog).toBeNull()
  })

  it('rejects a failed save with its words and asks for no offer', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({ ok: false, error: { code: 'forbidden' } })
    const { result } = hook({ kind: 'space', id: '7' })
    const failure = act(() => result.current.save([change], [session('19:00')], () => null))
    await expect(failure).rejects.toThrow('You may not change these sessions.')
    await expect(failure).rejects.not.toBeInstanceOf(CalendarSaveRefusal)
    expect(scheduleOffers).not.toHaveBeenCalled()
    expect(result.current.dialog).toBeNull()
  })

  it('rejects a stale save naming the session, with one way out that reloads', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '3', name: 'Session 3: Week 3' },
    })
    const reload = vi.fn()
    const { result } = hook({ kind: 'space', id: '7' }, reload)
    const refusal: unknown = await act(() =>
      result.current.save([change], [session('19:00')], () => null).catch((error) => error),
    )
    expect(refusal).toBeInstanceOf(CalendarSaveRefusal)
    const stale = refusal as CalendarSaveRefusal
    expect(stale.message).toBe('Someone else changed Session 3: Week 3 after the calendar loaded.')
    expect(stale.discard.label).toBe('Reload and lose my changes')
    stale.discard.then()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(scheduleOffers).not.toHaveBeenCalled()
  })

  it('shows that the offer failed, after a save that worked', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({ ok: true, items: [session('20:00')] })
    vi.mocked(scheduleOffers).mockRejectedValue(new Error('down'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = hook({ kind: 'course', id: '5' })
    await act(() => result.current.save([change], [session('19:00')], () => null))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.dialog).toBeNull()
  })

  it('is what both hosts save through, and no host calls the actions itself', async () => {
    for (const host of [
      'src/components/admin/course-calendar.tsx',
      'src/components/space/space-calendar-editor.tsx',
    ]) {
      const source = await readFile(host, 'utf8')
      expect(source).toContain('useScheduleSave(')
      expect(source).not.toMatch(/saveCalendarChanges|scheduleOffers|ScheduleOfferDialog/)
    }
  })
})
