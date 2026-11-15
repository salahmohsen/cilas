// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadCalendarItems } from '@/actions/load-calendar-items'
import { saveCalendarChanges } from '@/actions/save-calendar-changes'
import { scheduleOffers } from '@/actions/schedule-offers'
import { SpaceCalendarTab } from '@/components/space/space-calendar-tab'
import { SpaceViews } from '@/components/space/space-views'
import type { CalendarItem } from '@/lib/calendar-items'
import type { ScheduleOffer } from '@/lib/schedule-offer'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'

const push = vi.fn()
const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }))
vi.mock('@/actions/load-calendar-items', () => ({ loadCalendarItems: vi.fn() }))
vi.mock('@/actions/save-calendar-changes', () => ({ saveCalendarChanges: vi.fn() }))
vi.mock('@/actions/schedule-offers', () => ({ scheduleOffers: vi.fn() }))
vi.mock('@/lib/space-actions', () => ({ postCreateAction: vi.fn() }))

/**
 * The Calendar tab's edit mode (ADR 0011 step 4, unit 4): Edit and Done, a
 * save through the space parent and the shared offer, the stale save, and
 * the leave guard. The server actions are mocked; the e2e runs them.
 */
const session = (start: string, version = 'v1'): CalendarItem => ({
  id: '3',
  kind: 'session',
  title: 'Week 3',
  tone: 'yellow',
  cancelled: false,
  version,
  blocks: [{ id: 'a', date: '2026-11-17', start_time: start, end_time: '21:00' }],
})
const event: CalendarItem = {
  id: 'space-event:9',
  kind: 'space-event',
  title: 'Gathering',
  tone: 'neutral',
  readOnly: true,
  cancelled: false,
  version: 'v1',
  blocks: [{ id: '9', date: '2026-11-18', start_time: '17:00', end_time: '18:00' }],
}
const offer: ScheduleOffer = {
  space: { id: 7, name: 'Probe space' },
  language: 'en',
  text: '- Week 3 moves',
  block: null,
  preview: null,
}

/** A link to another page of the site, as the site header holds. */
const siteLink = () =>
  document.body.appendChild(
    Object.assign(document.createElement('a'), { href: '/en/spaces', textContent: 'All spaces' }),
  )

const view = (locale = 'en', items = [session('19:00'), event]) => (
  <NextIntlClientProvider
    locale={locale}
    messages={locale === 'ar' ? ar : en}
    timeZone="Africa/Cairo"
  >
    <SpaceViews path="/en/spaces/course/probe" value="calendar" hasCourse />
    <SpaceCalendarTab
      spaceId="7"
      courseId="5"
      items={items}
      canEdit
      day="2026-11-17"
      spaceHref="/en/spaces/course/probe"
    />
  </NextIntlClientProvider>
)

const show = (locale = 'en') => render(view(locale))

const block = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
/**
 * The pointer over Edit loads the edit-mode chunk before the click, as in the
 * browser: React does not retry a suspended render outside act() here.
 */
const startEditing = async () => {
  const edit = screen.getByRole('button', { name: 'Edit' })
  fireEvent.pointerEnter(edit)
  await import('@/components/space/space-calendar-editor')
  await new Promise((resolve) => setTimeout(resolve, 0))
  fireEvent.click(edit)
  await screen.findByRole('button', { name: 'Done' })
}
/** Save, after the pointer over it loaded the announcement dialog's chunk. */
const pressSave = async () => {
  const save = screen.getByRole('button', { name: 'Save' })
  fireEvent.pointerEnter(save)
  await import('@/components/space/schedule-offer-dialog')
  await new Promise((resolve) => setTimeout(resolve, 0))
  fireEvent.click(save)
}
const move = () => {
  block().focus()
  fireEvent.keyDown(block(), { key: 'ArrowDown' })
}
const leaveDialog = () => screen.queryByRole('dialog', { name: 'Leave without saving?' })

beforeAll(() => {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  Element.prototype.scrollIntoView = function () {}
  Element.prototype.getAnimations = () => []
})
beforeEach(() => {
  localStorage.clear()
  push.mockReset()
  refresh.mockReset()
  vi.useFakeTimers({ now: new Date('2026-11-15T10:00:00Z'), toFake: ['Date'] })
  vi.mocked(saveCalendarChanges)
    .mockReset()
    .mockResolvedValue({ ok: true, items: [session('19:15', 'v2'), event] })
  vi.mocked(scheduleOffers).mockReset().mockResolvedValue([offer])
  vi.mocked(loadCalendarItems)
    .mockReset()
    .mockResolvedValue({ ok: true, items: [session('20:00', 'v3'), event], canEdit: true })
})
afterEach(() => {
  cleanup()
  document.body.replaceChildren()
  vi.useRealTimers()
})

describe('the Calendar tab in edit mode', () => {
  it('swaps view mode for edit mode on Edit, and Done with nothing waiting goes back at once', async () => {
    show()
    expect(document.querySelector('[data-mode="view"]')).not.toBeNull()
    await startEditing()
    expect(document.querySelector('[data-mode="edit"]')).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(leaveDialog()).toBeNull()
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(document.querySelector('[data-mode="view"]')).not.toBeNull()
  })

  it('saves through the space parent, opens the announcement dialog, and Done shows the saved data', async () => {
    show()
    await startEditing()
    move()
    await pressSave()
    await waitFor(() => expect(saveCalendarChanges).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveCalendarChanges).mock.calls[0]![0]).toEqual({
      parent: { kind: 'space', id: '7' },
      changes: [expect.objectContaining({ op: 'move-block', itemId: '3', start_time: '19:15' })],
    })
    expect(scheduleOffers).toHaveBeenCalledWith(
      { courseId: '5', before: [session('19:00')], after: [session('19:15', 'v2')] },
      'en',
    )
    expect(refresh).toHaveBeenCalledTimes(1)
    const dialog = await screen.findByRole('dialog', { name: 'Announce this change?' })
    expect(within(dialog).getByText(/Probe space/)).toBeInTheDocument()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Skip' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(leaveDialog()).toBeNull()
    await screen.findByRole('button', { name: 'Edit' })
    expect(block()).toHaveAccessibleName(/7:15 PM to 9 PM/)
  })

  it('records the current conflict behavior when a drawer refresh replaces the edited session', async () => {
    const rendered = show()
    await startEditing()
    move()
    expect(block()).toHaveAccessibleName(/7:15 PM to 9:15 PM, Unsaved/)

    // A drawer save calls router.refresh(), which supplies these new server items.
    rendered.rerender(view('en', [session('20:00', 'v2'), event]))
    await waitFor(() => expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(saveCalendarChanges).not.toHaveBeenCalled()
    expect(
      screen
        .getAllByRole('status')
        .some((status) =>
          status.textContent?.includes(
            'Your unsaved changes to Week 3 were dropped, because it changed somewhere else.',
          ),
        ),
    ).toBe(true)
  })

  it('keeps the changes after a failed save and offers nothing', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({ ok: false, error: { code: 'forbidden' } })
    show()
    await startEditing()
    move()
    await pressSave()
    expect(await screen.findByRole('alert')).toHaveTextContent('You may not change these sessions.')
    expect(block()).toHaveAccessibleName(/7:15 PM to 9:15 PM, Unsaved/)
    expect(scheduleOffers).not.toHaveBeenCalled()
    expect(screen.queryByRole('dialog', { name: 'Announce this change?' })).toBeNull()
  })

  it('names the session in a stale save, keeps the changes, and reloads only on the one button', async () => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '3', name: 'Session 1: Week 3' },
    })
    show()
    await startEditing()
    move()
    await pressSave()
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Someone else changed Session 1: Week 3 after the calendar loaded.',
    )
    expect(block()).toHaveAccessibleName(/Unsaved/)
    expect(loadCalendarItems).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Reload and lose my changes' }))
    await waitFor(() =>
      expect(loadCalendarItems).toHaveBeenCalledWith({ kind: 'space', id: '7' }, 'en'),
    )
    await waitFor(() => expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/))
    expect(scheduleOffers).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('button', { name: 'Edit' })
    expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/)
  })

  it.each(['refused', 'rejected'])('shows a failed reload (%s)', async (failure) => {
    vi.mocked(saveCalendarChanges).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '3', name: 'Session 1: Week 3' },
    })
    if (failure === 'refused')
      vi.mocked(loadCalendarItems).mockResolvedValue({
        ok: false,
        error: { code: 'unauthenticated' },
      })
    else vi.mocked(loadCalendarItems).mockRejectedValue(new Error('Connection lost'))
    show()
    await startEditing()
    move()
    await pressSave()
    fireEvent.click(await screen.findByRole('button', { name: 'Reload and lose my changes' }))
    await waitFor(() =>
      expect(
        screen
          .getAllByRole('alert')
          .some((alert) => alert.textContent?.includes(en.Spaces.calendarFailed)),
      ).toBe(true),
    )
  })

  it('asks before Done while changes wait: Stay keeps them, Leave anyway drops them', async () => {
    show()
    await startEditing()
    move()
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Stay' }))
    await waitFor(() => expect(leaveDialog()).toBeNull())
    expect(block()).toHaveAccessibleName(/Unsaved/)

    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Leave anyway' }))
    await screen.findByRole('button', { name: 'Edit' })
    expect(block()).toHaveAccessibleName(/7 PM to 9 PM$/)
    expect(saveCalendarChanges).not.toHaveBeenCalled()
  })

  it('asks before a tab switch and a link inside the site, and closing the page asks the browser', async () => {
    show()
    await startEditing()
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(unload()).toBe(false)
    move()
    expect(unload()).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }))
    expect(push).toHaveBeenCalledWith('/en/spaces/course/probe?tab=announcements', {
      scroll: false,
    })

    await waitFor(() => expect(leaveDialog()).toBeNull())
    push.mockReset()
    fireEvent.click(siteLink())
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }))
    expect(push).toHaveBeenCalledWith('http://localhost:3000/en/spaces')
  })

  it('lets a tab switch go at once when nothing waits', async () => {
    show()
    await startEditing()
    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    expect(leaveDialog()).toBeNull()
    expect(push).toHaveBeenCalledTimes(1)
  })

  it('words Edit, Done and the question in Arabic', async () => {
    show('ar')
    fireEvent.click(screen.getByRole('button', { name: ar.Spaces.calendarEdit }))
    await screen.findByRole('button', { name: ar.Spaces.calendarDone })
    const arabic = document.querySelector<HTMLElement>('[data-span-id]')!
    arabic.focus()
    fireEvent.keyDown(arabic, { key: 'ArrowDown' })
    fireEvent.click(screen.getByRole('button', { name: ar.Spaces.calendarDone }))
    expect(
      await screen.findByRole('dialog', { name: ar.Spaces.calendarLeaveTitle }),
    ).toBeInTheDocument()
  })
})
