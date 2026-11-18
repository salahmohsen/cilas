import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { FormEvent } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ScheduleActionsProvider, type ScheduleActions } from '@/components/space/schedule-actions'
import { SpaceCalendarTab } from '@/components/space/space-calendar-tab'
import { SpaceViews } from '@/components/space/space-views'
import type { CalendarItem } from '@/lib/calendar-items'
import type { ScheduleOffer } from '@/lib/schedule-offer'
import type { SessionEdit } from '@/lib/session-edit'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import { IntlProvider } from '../../testing/intl.test-utils'
import { scheduleActionsHost } from '../../testing/schedule-actions.test-utils'
import { renderWithNavigation } from '../../testing/navigation.test-utils'

type Saved = Awaited<ReturnType<ScheduleActions['saveScheduleEdits']>>
type Reloaded = Awaited<ReturnType<ScheduleActions['loadCalendarItems']>>
type Loaded = Awaited<ReturnType<ScheduleActions['loadSessionEdit']>>

const session = (start: string, version = 'v1') =>
  ({
    id: '3',
    kind: 'session',
    title: 'Week 3',
    tone: 'yellow',
    cancelled: false,
    version,
    blocks: [{ id: 'a', date: '2026-11-17', start_time: start, end_time: '21:00' }],
  }) satisfies CalendarItem
const event = {
  id: 'space-event:9',
  kind: 'space-event',
  title: 'Gathering',
  tone: 'neutral',
  readOnly: true,
  cancelled: false,
  version: 'v1',
  blocks: [{ id: '9', date: '2026-11-18', start_time: '17:00', end_time: '18:00' }],
} satisfies CalendarItem
const offer = {
  space: { id: 7, name: 'Probe space' },
  language: 'en',
  text: '- Week 3 moves',
  block: null,
  preview: null,
} satisfies ScheduleOffer

const formValues = {
  title: 'Week 3',
  description: '',
  cancelled: false,
  bibliography: [],
  activities: [],
  meetings: [{ id: 'a', date: '2026-11-17', start_time: '19:00', end_time: '21:00' }],
} satisfies SessionEdit

const defaults: {
  save: () => Promise<Saved>
  reload: () => Promise<Reloaded>
  edit: () => Promise<Loaded>
} = {
  save: async () => ({
    ok: true,
    before: [],
    after: [],
    items: [session('19:15', 'v2'), event],
  }),
  reload: async () => ({ ok: true, items: [session('20:00', 'v3'), event], canEdit: true }),
  edit: async () => ({ ok: false, error: 'failed' }),
}

const host = {
  saves: [] as Array<Parameters<ScheduleActions['saveScheduleEdits']>>,
  offers: [] as Array<Parameters<ScheduleActions['scheduleOffers']>>,
  reloads: [] as Array<Parameters<ScheduleActions['loadCalendarItems']>>,
  edits: [] as Array<Parameters<ScheduleActions['loadSessionEdit']>>,
  ...defaults,
}

const actions = {
  ...scheduleActionsHost().actions,
  saveScheduleEdits: async (...args) => {
    host.saves.push(args)
    return host.save()
  },
  scheduleOffers: async (...args) => {
    host.offers.push(args)
    return [offer]
  },
  loadCalendarItems: async (...args) => {
    host.reloads.push(args)
    return host.reload()
  },
  loadSessionEdit: async (...args) => {
    host.edits.push(args)
    return host.edit()
  },
} satisfies ScheduleActions

const siteLink = () =>
  document.body.appendChild(
    Object.assign(document.createElement('a'), { href: '/en/spaces', textContent: 'All spaces' }),
  )

const view = (locale: 'en' | 'ar' = 'en', items = [session('19:00'), event]) => (
  <IntlProvider locale={locale}>
    <ScheduleActionsProvider actions={actions}>
      <SpaceViews path="/en/spaces/course/probe" value="calendar" hasCourse />
      <SpaceCalendarTab
        spaceId="7"
        courseId="5"
        items={items}
        canEdit
        day="2026-11-17"
        spaceHref="/en/spaces/course/probe"
      />
    </ScheduleActionsProvider>
  </IntlProvider>
)

let shown: ReturnType<typeof renderWithNavigation>
const show = (locale: 'en' | 'ar' = 'en') => {
  shown = renderWithNavigation(view(locale), { url: '/en/spaces/course/probe?tab=calendar' })
  return shown
}
const memory = () => shown.memory

const block = () => screen.getByRole('button', { name: /^Week 3, Tuesday/ })
const startEditing = async () => {
  const edit = screen.getByRole('button', { name: 'Edit' })
  fireEvent.pointerEnter(edit)
  await import('@/components/space/space-calendar-editor')
  await new Promise((resolve) => setTimeout(resolve, 0))
  fireEvent.click(edit)
  await screen.findByRole('button', { name: 'Done' })
}
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

beforeEach(() => {
  localStorage.clear()
  host.saves.length = 0
  host.offers.length = 0
  host.reloads.length = 0
  host.edits.length = 0
  Object.assign(host, defaults)
  vi.useFakeTimers({ now: new Date('2026-11-15T10:00:00Z'), toFake: ['Date'] })
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
    await waitFor(() => expect(host.saves).toHaveLength(1))
    expect(host.saves[0]![0]).toEqual({
      calendar: {
        parent: { kind: 'space', id: '7' },
        changes: [expect.objectContaining({ op: 'move-block', itemId: '3', start_time: '19:15' })],
      },
      details: [],
    })
    expect(host.offers).toEqual([
      [{ courseId: '5', before: [session('19:00')], after: [session('19:15', 'v2')] }, 'en'],
    ])
    expect(memory().refreshes).toBe(1)
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

    rendered.rerender(view('en', [session('20:00', 'v2'), event]))
    await waitFor(() => expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/))
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull()
    expect(host.saves).toHaveLength(0)
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
    host.save = async () => ({ ok: false, error: { code: 'forbidden' } })
    show()
    await startEditing()
    move()
    await pressSave()
    expect(await screen.findByRole('alert')).toHaveTextContent('You may not change these sessions.')
    expect(block()).toHaveAccessibleName(/7:15 PM to 9:15 PM, Unsaved/)
    expect(host.offers).toHaveLength(0)
    expect(screen.queryByRole('dialog', { name: 'Announce this change?' })).toBeNull()
  })

  it('names the session in a stale save, keeps the changes, and reloads only on the one button', async () => {
    host.save = async () => ({
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
    expect(host.reloads).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Reload and lose my changes' }))
    await waitFor(() => expect(host.reloads).toEqual([[{ kind: 'space', id: '7' }, 'en']]))
    await waitFor(() => expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/))
    expect(host.offers).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    await screen.findByRole('button', { name: 'Edit' })
    expect(block()).toHaveAccessibleName(/8 PM to 9 PM$/)
  })

  it.each(['refused', 'rejected'])('shows a failed reload (%s)', async (failure) => {
    host.save = async () => ({
      ok: false,
      error: { code: 'stale', itemId: '3', name: 'Session 1: Week 3' },
    })
    if (failure === 'refused')
      host.reload = async () => ({ ok: false, error: { code: 'unauthenticated' } })
    else host.reload = async () => Promise.reject(new Error('Connection lost'))
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
    expect(host.saves).toHaveLength(0)
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
    expect(memory().visits).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }))
    expect(memory().visits).toEqual([
      {
        method: 'push',
        href: '/en/spaces/course/probe?tab=announcements',
        options: { scroll: false },
      },
    ])

    await waitFor(() => expect(leaveDialog()).toBeNull())
    const visited = memory().visits.length
    fireEvent.click(siteLink())
    expect(await screen.findByRole('dialog', { name: 'Leave without saving?' })).toBeInTheDocument()
    expect(memory().visits).toHaveLength(visited)
    fireEvent.click(screen.getByRole('button', { name: 'Leave anyway' }))
    expect(memory().visits.slice(visited)).toEqual([
      {
        method: 'push',
        href: new URL('/en/spaces', window.location.href).href,
        options: undefined,
      },
    ])
  })

  it('lets a tab switch go at once when nothing waits', async () => {
    show()
    await startEditing()
    fireEvent.click(screen.getByRole('button', { name: 'Announcements' }))
    expect(leaveDialog()).toBeNull()
    expect(memory().visits).toHaveLength(1)
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

const holdToDelete = async (dialog: HTMLElement) => {
  const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
  vi.useRealTimers()
  fireEvent.keyDown(hold, { key: ' ' })
  await waitFor(
    () => expect(!hold.isConnected || hold.getAttribute('data-state') === 'done').toBe(true),
    { timeout: 4000 },
  )
  vi.useFakeTimers({ now: new Date('2026-11-15T10:00:00Z'), toFake: ['Date'] })
}
const openStagedForm = async (target = block()) => {
  fireEvent.pointerEnter(target)
  await import('@/components/space/schedule-edit-drawer')
  await import('@/components/space/session-form')
  await new Promise((resolve) => setTimeout(resolve, 0))
  fireEvent.click(target)
  const title = await screen.findByRole('textbox', { name: en.SessionEdit.title })
  return title.closest('[role="dialog"]') as HTMLElement
}

describe('details staged with the calendar', () => {
  beforeEach(() => {
    host.edit = async () => ({ ok: true, values: formValues, version: 'v1' })
  })

  it('applies a title without saving, marks the block and guards leaving; Cancel keeps that stage', async () => {
    show()
    await startEditing()
    const dialog = await openStagedForm()
    expect(within(dialog).queryByRole('button', { name: 'Save changes' })).toBeNull()
    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Applied title' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() =>
      expect(screen.queryByRole('textbox', { name: en.SessionEdit.title })).toBeNull(),
    )
    const changed = await screen.findByRole('button', { name: /^Applied title, Tuesday/ })
    expect(changed).toHaveAttribute('data-unsaved')
    expect(screen.getAllByText('1 unsaved change').length).toBeGreaterThan(0)
    expect(host.saves).toHaveLength(0)
    fireEvent.click(screen.getByRole('button', { name: 'Done' }))
    expect(leaveDialog()).not.toBeNull()
    fireEvent.click(
      within(leaveDialog()!).getByRole('button', { name: en.Spaces.calendarLeaveStay }),
    )
    const again = await openStagedForm(changed)
    expect(within(again).getByRole('textbox', { name: en.SessionEdit.title })).toHaveValue(
      'Applied title',
    )
    fireEvent.change(within(again).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Discard this' },
    })
    fireEvent.click(within(again).getByRole('button', { name: 'Cancel' }))
    expect(
      await screen.findByRole('button', { name: /^Applied title, Tuesday/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/unsaved changes to .* were dropped/)).toBeNull()
    await pressSave()
    await waitFor(() => expect(host.saves).toHaveLength(1))
    expect(host.saves).toEqual([
      [
        {
          calendar: { parent: { kind: 'space', id: '7' }, changes: [] },
          details: [
            expect.objectContaining({
              op: 'edit',
              id: '3',
              version: 'v1',
              values: expect.objectContaining({ title: 'Applied title' }),
            }),
          ],
        },
        'en',
      ],
    ])
    expect(host.offers).toHaveLength(1)
  })

  it('keeps a move when a title is applied and sends them together', async () => {
    show()
    await startEditing()
    move()
    const dialog = await openStagedForm()
    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Moved and renamed' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Apply' }))
    await waitFor(() => expect(screen.getAllByText('2 unsaved changes').length).toBeGreaterThan(0))
    await pressSave()
    await waitFor(() => expect(host.saves).toHaveLength(1))
    expect(host.saves[0]![0]).toMatchObject({
      calendar: { changes: [{ op: 'move-block', start_time: '19:15' }] },
      details: [{ values: { title: 'Moved and renamed' } }],
    })
    expect(host.offers).toHaveLength(1)
  })

  it('Enter and Delete stage removal without saving', async () => {
    show()
    await startEditing()
    const dialog = await openStagedForm()
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    await act(async () => {
      hold.focus()
      fireEvent.keyDown(hold, { key: 'Enter' })
    })
    const confirm = await screen.findByRole('dialog', { name: en.SessionEdit.deleteTitle })
    fireEvent.click(within(confirm).getByRole('button', { name: en.SessionEdit.delete }))
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Week 3, Tuesday/ })).toBeNull(),
    )
    expect(host.saves).toHaveLength(0)
    expect(screen.getAllByText('1 unsaved change').length).toBeGreaterThan(0)
  })

  it('shows Apply in the footer, and a full hold stages the removal until Save', async () => {
    show()
    await startEditing()
    const dialog = await openStagedForm()
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.apply })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.save })).toBeNull()
    expect(within(dialog).queryByRole('group', { name: 'Meeting 1' })).toBeNull()
    await holdToDelete(dialog)
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^Week 3, Tuesday/ })).toBeNull(),
    )
    expect(host.saves).toHaveLength(0)
    await pressSave()
    await waitFor(() => expect(host.saves).toHaveLength(1))
    expect(host.saves[0]![0].details).toEqual([{ op: 'delete', id: '3', version: 'v1' }])
  })

  it('opens a new block on its form; deleting it excludes it from a later Save', async () => {
    show()
    await startEditing()
    fireEvent.click(screen.getByRole('button', { name: /^Add a block on Tuesday, November 17/ }))
    const added = screen.getByRole('button', { name: /^Session, Tuesday/ })
    const dialog = await openStagedForm(added)
    expect(within(dialog).getByRole('textbox', { name: en.SessionEdit.title })).toHaveValue('')
    await holdToDelete(dialog)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Save' })).toBeNull())
    expect(host.saves).toHaveLength(0)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    move()
    await pressSave()
    await waitFor(() => expect(host.saves).toHaveLength(1))
    expect(host.saves[0]![0]).toMatchObject({
      calendar: { changes: [{ op: 'move-block', itemId: '3' }] },
      details: [],
    })
  })
})

it('uses the selected content locale in an Arabic admin form and keeps Apply out of the course form', async () => {
  const { ScheduleEditDrawer } = await import('@/components/space/schedule-edit-drawer')
  host.edit = async () => ({ ok: true, values: formValues, version: 'v1' })
  const applied: SessionEdit[] = []
  let outerSubmits = 0
  renderWithNavigation(
    <IntlProvider locale="ar">
      <ScheduleActionsProvider actions={actions}>
        <form
          onSubmit={(submitted: FormEvent) => {
            outerSubmits++
            submitted.preventDefault()
          }}
        >
          <ScheduleEditDrawer
            item={session('19:00')}
            text={
              (await import('@/components/admin/calendar-admin-text')).calendarAdminText('ar', ar)
                .save
            }
            contentLocale="en"
            onClose={vi.fn()}
            onApply={(values) => applied.push(values)}
            onDelete={vi.fn()}
          />
        </form>
      </ScheduleActionsProvider>
    </IntlProvider>,
  )
  const title = await screen.findByRole('textbox', { name: ar.SessionEdit.title })
  expect(host.edits).toEqual([['3', 'en']])
  expect(title).toHaveValue('Week 3')
  expect(title).toHaveAttribute('dir', 'ltr')
  fireEvent.change(title, { target: { value: 'English content' } })
  fireEvent.click(screen.getByRole('button', { name: ar.SessionEdit.apply }))
  await waitFor(() => expect(applied).toHaveLength(1))
  expect(applied[0]!.title).toBe('English content')
  expect(outerSubmits).toBe(0)
  expect(host.saves).toHaveLength(0)
})
