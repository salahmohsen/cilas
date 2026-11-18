import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { saveScheduleEdits } from '@/actions/save-schedule-edits'
import type { scheduleOffers } from '@/actions/schedule-offers'
import { calendarAdminText } from '@/components/admin/calendar-admin-text'
import { CalendarSaveRefusal } from '@/components/calendar/ui/save-refusal'
import { useScheduleSaveWith } from '@/components/space/use-schedule-save-with'
import type { CalendarChange, CalendarItem } from '@/lib/calendar-items'
import type { ScheduleOffer } from '@/lib/schedule-offer'

import en from '../../messages/en.json'

const { save: text } = calendarAdminText('en', en)

const session = (start: string) =>
  ({
    id: '3',
    kind: 'session',
    title: 'Week 3',
    tone: 'yellow',
    cancelled: false,
    version: 'v1',
    blocks: [{ id: 'a', date: '2034-10-05', start_time: start, end_time: '21:00' }],
  }) satisfies CalendarItem
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

type Saved = Awaited<ReturnType<typeof saveScheduleEdits>>

const host = (
  parent: { kind: string; id: string },
  saved: Saved,
  answer: ScheduleOffer[] | Error = [offer],
) => {
  const saves: Parameters<typeof saveScheduleEdits>[] = []
  const asked: Parameters<typeof scheduleOffers>[] = []
  const reload = vi.fn()
  const save: typeof saveScheduleEdits = async (...args) => {
    saves.push(args)
    return saved
  }
  const offers: typeof scheduleOffers = async (...args) => {
    asked.push(args)
    if (answer instanceof Error) throw answer
    return answer
  }
  const { result } = renderHook(() =>
    useScheduleSaveWith({
      parent,
      courseId: '5',
      locale: 'en',
      language: 'en',
      text,
      reload,
      save,
      offers,
    }),
  )
  return { result, saves, asked, reload }
}

describe('useScheduleSave, the one save-then-offer of every host', () => {
  for (const parent of [
    { kind: 'course', id: '5' },
    { kind: 'space', id: '7' },
  ])
    it(`saves on the ${parent.kind} parent, then offers on the items that can change`, async () => {
      const after = [session('20:00'), { ...event, title: 'Talk, renamed' }]
      const { result, saves, asked } = host(parent, { ok: true, before: [], after, items: after })
      let saved: CalendarItem[] = []
      await act(async () => {
        saved = await result.current.save([change], [session('19:00'), event], () => null)
      })
      expect(saved).toBe(after)
      expect(saves).toEqual([[{ calendar: { parent, changes: [change] }, details: [] }, 'en']])
      expect(asked).toEqual([
        [{ courseId: '5', before: [session('19:00')], after: [session('20:00')] }, 'en'],
      ])
      await waitFor(() => expect(result.current.dialog).not.toBeNull())
    })

  it('offers nothing when nothing counts', async () => {
    const { result, asked } = host(
      { kind: 'space', id: '7' },
      { ok: true, before: [], after: [], items: [session('19:00')] },
      [],
    )
    await act(() => result.current.save([change], [session('19:00')], () => null))
    await waitFor(() => expect(asked).toHaveLength(1))
    expect(result.current.dialog).toBeNull()
  })

  it('rejects a failed save with its words and asks for no offer', async () => {
    const { result, asked } = host(
      { kind: 'space', id: '7' },
      { ok: false, error: { code: 'forbidden' } },
    )
    const failure = act(() => result.current.save([change], [session('19:00')], () => null))
    await expect(failure).rejects.toThrow('You may not change these sessions.')
    await expect(failure).rejects.not.toBeInstanceOf(CalendarSaveRefusal)
    expect(asked).toEqual([])
    expect(result.current.dialog).toBeNull()
  })

  it('rejects a stale save naming the session, with one way out that reloads', async () => {
    const { result, asked, reload } = host(
      { kind: 'space', id: '7' },
      { ok: false, error: { code: 'stale', itemId: '3', name: 'Session 3: Week 3' } },
    )
    const refusal: unknown = await act(() =>
      result.current.save([change], [session('19:00')], () => null).catch((error) => error),
    )
    expect(refusal).toBeInstanceOf(CalendarSaveRefusal)
    const stale = refusal as CalendarSaveRefusal
    expect(stale.message).toBe('Someone else changed Session 3: Week 3 after the calendar loaded.')
    expect(stale.discard.label).toBe('Reload and lose my changes')
    stale.discard.then()
    expect(reload).toHaveBeenCalledTimes(1)
    expect(asked).toEqual([])
  })

  it('shows that the offer failed, after a save that worked', async () => {
    const reported = vi.spyOn(console, 'error')
    const { result } = host(
      { kind: 'course', id: '5' },
      { ok: true, before: [], after: [], items: [session('20:00')] },
      new Error('down'),
    )
    await act(() => result.current.save([change], [session('19:00')], () => null))
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.dialog).toBeNull()
    expect(reported).toHaveBeenCalledWith('schedule offer failed', expect.any(Error))
    reported.mockRestore()
  })
})
