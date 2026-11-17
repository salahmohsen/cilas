// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { useSyncExternalStore } from 'react'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'

import { loadSessionView, type SessionViewResult } from '@/actions/load-session-view'
import { scheduleOffers } from '@/actions/schedule-offers'
import { saveScheduleEdits } from '@/actions/save-schedule-edits'
import { loadSessionEdit, type SessionEdit } from '@/actions/session-edit'
import {
  SessionDrawerHost,
  SessionLink,
  sessionTriggerProps,
} from '@/components/space/session-drawer-host'
import { numberedSessions } from '@/lib/meetings'
import type { Session } from '@/payload-types'
import en from '../../messages/en.json'
import ar from '../../messages/ar.json'

vi.mock('@/actions/load-session-view', () => ({ loadSessionView: vi.fn() }))
vi.mock('@/actions/session-edit', () => ({ loadSessionEdit: vi.fn() }))
vi.mock('@/actions/schedule-offers', () => ({ scheduleOffers: vi.fn() }))
vi.mock('@/actions/save-schedule-edits', () => ({ saveScheduleEdits: vi.fn() }))
const refresh = vi.fn()

// Next folds pushState and replaceState into its router; this stands in for that.
const URL_EVENT = 'test:url'
const subscribe = (change: () => void) => {
  window.addEventListener('popstate', change)
  window.addEventListener(URL_EVENT, change)
  return () => {
    window.removeEventListener('popstate', change)
    window.removeEventListener(URL_EVENT, change)
  }
}
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh }),
  useSearchParams: () =>
    new URLSearchParams(
      useSyncExternalStore(
        subscribe,
        () => window.location.search,
        () => '',
      ),
    ),
}))

let phone = false
const session = (id: number, position: number, extra: Partial<Session> = {}): Session =>
  ({
    id,
    course: 1,
    position,
    title: null,
    cancelled: false,
    createdAt: '',
    updatedAt: '',
    meetings: [
      { id: `${id}`, date: `2026-11-${10 + position}`, start_time: '19:00', end_time: '21:00' },
    ],
    ...extra,
  }) as Session

const sessions = [
  session(11, 1),
  session(12, 2),
  session(13, 3, {
    title: 'Reading the city',
    delivery: 'ONLINE',
    description: 'Walk **slowly**.',
    bibliography: [{ id: 'm1', type: 'reading', title: 'Invisible Cities' }],
    activities: [{ id: 'a1', kind: 'discussion', description: 'In pairs' }],
  }),
  session(14, 4, { title: 'Called off', cancelled: true }),
]
const course = {
  id: 1,
  slug: 'probe',
  title: 'Probe course',
  subtitle: null,
  description: null,
  syllabus_tentative: null,
  course_type: 'LAB',
} as const
const shown = (id: number, canEdit = false): SessionViewResult => ({
  ok: true,
  course: course as never,
  session: numberedSessions(sessions).find((n) => n.session.id === id)!,
  spaceHref: '/en/spaces/course/probe',
  canEdit,
})

const page = async (locale: 'en' | 'ar' = 'en') =>
  act(async () => {
    render(
      <NextIntlClientProvider
        locale={locale}
        messages={locale === 'ar' ? ar : en}
        timeZone="Africa/Cairo"
      >
        <SessionLink id="13" href="/en/spaces/course/probe?tab=syllabus&open=13">
          {en.SpacePost.sessionOpen}
        </SessionLink>
        <SessionDrawerHost />
      </NextIntlClientProvider>,
    )
  })

beforeAll(async () => {
  // Load the drawer's chunk first, as a pointer over a trigger does: React does
  // not retry a suspended render outside act() in this environment.
  sessionTriggerProps.onPointerEnter()
  await import('@/components/space/session-drawer')
  // The Edit form's chunk too, as a pointer over Edit loads it.
  await import('@/components/space/session-form')
  await new Promise((resolve) => setTimeout(resolve, 0))
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history)
    window.history[method] = (...args: Parameters<History['pushState']>) => {
      original(...args)
      window.dispatchEvent(new Event(URL_EVENT))
    }
  }
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.IntersectionObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  } as unknown as typeof IntersectionObserver
  Element.prototype.scrollIntoView = vi.fn()
})
beforeEach(() => {
  phone = false
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: phone,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  }))
  window.history.replaceState(null, '', '/en/spaces/course/probe?tab=syllabus')
  vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id)))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.mocked(loadSessionView).mockReset()
})

describe('the session drawer', () => {
  it.each(['en', 'ar'] as const)('names the sheet controls in %s', async (locale) => {
    phone = true
    await page(locale)
    await act(async () => {
      fireEvent.click(screen.getByRole('link', { name: en.SpacePost.sessionOpen }))
    })
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    const words = locale === 'ar' ? ar.SpacePost : en.SpacePost
    const expand = within(dialog).getByRole('button', { name: words.sheetExpand })
    fireEvent.click(expand)
    expect(within(dialog).getByRole('button', { name: words.sheetCollapse })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent(words.sheetExpanded)
    fireEvent.click(within(dialog).getByRole('button', { name: words.sheetCollapse }))
    expect(within(dialog).getByRole('button', { name: words.sheetExpand })).toHaveAttribute(
      'aria-expanded',
      'false',
    )
    expect(within(dialog).getByRole('status')).toHaveTextContent(words.sheetCollapsed)
  })
  it.each([false, true])(
    'ends view mode with Edit session then the posts link (phone=%s)',
    async (onPhone) => {
      phone = onPhone
      vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id), true))
      window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
      await page()
      const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
      const edit = await within(dialog).findByRole('button', { name: en.SessionEdit.edit })
      const posts = within(dialog).getByRole('link', { name: en.SpacePost.sessionDrawerViewPosts })
      expect(posts).toHaveAttribute('href', '/en/spaces/course/probe?session=13')
      expect(within(dialog).getByText('7 – 9 PM')).toBeInTheDocument()
      expect(
        [
          ...dialog.querySelectorAll(
            'button:not([disabled]), a[href], input, select, textarea, [tabindex="0"]',
          ),
        ].slice(-2),
      ).toEqual([edit, posts])
    },
  )

  it('is not in the page until a session is opened', async () => {
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(loadSessionView).not.toHaveBeenCalled()
  })

  it('opens on a click with the param, takes focus, closes on Escape, and gives focus back', async () => {
    await page()
    const link = screen.getByRole('link', { name: en.SpacePost.sessionOpen })
    link.focus()
    await act(async () => {
      fireEvent.click(link)
    })
    expect(window.location.search).toBe('?tab=syllabus&open=13')

    // The heading names the session; the view under it shows its number, not its title again.
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(loadSessionView).toHaveBeenCalledWith('13', 'en')
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(within(dialog).getByText(en.SpacePost.sessionDrawerTimes)).toBeInTheDocument()

    // The one session view: number, title, times, delivery, Markdown, materials, activities.
    const view = within(dialog).getByRole('region', { name: 'Session 3: Reading the city' })
    expect(view).toHaveTextContent('Session 3')
    expect(view).not.toHaveTextContent('Reading the city')
    expect(within(dialog).getByText('7 – 9 PM')).toBeInTheDocument()
    expect(within(dialog).getAllByText(en.Course.delivery.ONLINE).length).toBeGreaterThan(0)
    expect(dialog.querySelector('strong')?.textContent).toBe('slowly')
    expect(within(dialog).getByText('Invisible Cities')).toBeInTheDocument()
    expect(within(dialog).getByText('In pairs')).toBeInTheDocument()
    expect(
      within(dialog).getByRole('link', { name: en.SpacePost.sessionDrawerViewPosts }),
    ).toHaveAttribute('href', '/en/spaces/course/probe?session=13')
    // Only the people who may edit the session see Edit.
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.edit })).toBeNull()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(window.location.search).toBe('?tab=syllabus'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(link)
  })

  it('opens from a link with the param and drops the param in place on close', async () => {
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=14')
    const length = window.history.length
    await page()
    const dialog = await screen.findByRole('dialog', { name: 'Called off' })
    expect(within(dialog).getAllByText(en.Course.cancelled).length).toBeGreaterThan(0)
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.history.length).toBe(length)
  })

  it('says so when the session is gone or not the reader’s to read', async () => {
    vi.mocked(loadSessionView).mockResolvedValue({ ok: false, error: 'not-found' })
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=99')
    await page()
    expect(await screen.findByText(en.SpacePost.sessionGone)).toBeInTheDocument()
  })

  it('slides from the left in Arabic, with Arabic labels', async () => {
    window.history.replaceState(null, '', '/ar/spaces/course/probe?open=13')
    vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id)))
    await page('ar')
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(
      within(dialog).getByRole('button', { name: ar.SpacePost.sessionDrawerClose }),
    ).toBeInTheDocument()
  })

  it('is a bottom sheet on a phone', async () => {
    phone = true
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    await page()
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).not.toHaveAttribute('data-side')
    expect(screen.getByRole('button', { name: /^(Expand|Collapse) sheet$/ })).toBeInTheDocument()
    await act(async () => {})
  })
})

const editValues = (extra: Partial<SessionEdit> = {}): SessionEdit => ({
  title: 'Reading the city',
  description: 'Walk **slowly**.',
  cancelled: false,
  meetings: [{ id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' }],
  bibliography: [{ id: 'b1', type: 'reading', title: 'Invisible Cities', href: '', note: '' }],
  activities: [{ id: 'a1', kind: 'discussion', description: 'In pairs' }],
  ...extra,
})

const openForm = async (values = editValues()) => {
  vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id), true))
  vi.mocked(loadSessionEdit).mockResolvedValue({ ok: true, values, version: 'v1' })
  window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
  await page()
  const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
  const edit = await within(dialog).findByRole('button', { name: en.SessionEdit.edit })
  // The form's chunk loads from the button's pointer, before the click.
  fireEvent.pointerEnter(edit)
  await act(async () => {})
  fireEvent.click(edit)
  await within(dialog).findByRole('textbox', { name: en.SessionEdit.title })
  return dialog
}

const save = (dialog: HTMLElement) =>
  act(async () => {
    fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.save }))
  })

describe('the session drawer’s Cancel session menu and course row', () => {
  beforeEach(() => {
    vi.mocked(saveScheduleEdits).mockReset()
    vi.mocked(scheduleOffers).mockReset().mockResolvedValue([])
    refresh.mockReset()
  })
  const openView = async (id: number, canEdit: boolean) => {
    vi.mocked(loadSessionView).mockImplementation(async () => shown(id, canEdit))
    window.history.replaceState(null, '', `/en/spaces/course/probe?open=${id}`)
    await page()
    return screen.findByRole('dialog')
  }
  const choose = async (dialog: HTMLElement, name: string) => {
    const more = await within(dialog).findByRole('button', { name: en.SessionEdit.moreActions })
    fireEvent.keyDown(more, { key: 'Enter' })
    fireEvent.click(await screen.findByRole('menuitem', { name }))
  }

  it('links the course, by its name', async () => {
    const dialog = await openView(13, false)
    expect(await within(dialog).findByRole('link', { name: 'Probe course' })).toHaveAttribute(
      'href',
      '/en/study/probe',
    )
  })

  it('gives a reader no More actions menu', async () => {
    const dialog = await openView(13, false)
    await within(dialog).findByRole('link', { name: en.SpacePost.sessionDrawerViewPosts })
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.moreActions })).toBeNull()
  })

  it('asks first, with Keep session focused, and saves nothing on Keep', async () => {
    const dialog = await openView(13, true)
    await choose(dialog, en.SessionEdit.cancelSession)
    const ask = await screen.findByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })
    const keep = within(ask).getByRole('button', { name: en.SessionEdit.keepSession })
    await waitFor(() => expect(document.activeElement).toBe(keep))
    fireEvent.click(keep)
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })).toBeNull(),
    )
    expect(saveScheduleEdits).not.toHaveBeenCalled()
  })

  it('cancels through the one save path, offers the announcement, and reads the view again', async () => {
    vi.mocked(loadSessionEdit).mockResolvedValue({ ok: true, values: editValues(), version: 'v1' })
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    const dialog = await openView(13, true)
    await choose(dialog, en.SessionEdit.cancelSession)
    const ask = await screen.findByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: en.SessionEdit.cancelSession }))
    })
    expect(saveScheduleEdits).toHaveBeenCalledTimes(1)
    const [{ details }] = vi.mocked(saveScheduleEdits).mock.calls[0]!
    expect(details).toEqual([
      expect.objectContaining({
        op: 'edit',
        id: '13',
        values: expect.objectContaining({ cancelled: true }),
      }),
    ])
    expect(scheduleOffers).toHaveBeenCalledWith(expect.objectContaining({ courseId: '1' }), 'en')
    expect(refresh).toHaveBeenCalled()
  })

  it('offers Restore session for a cancelled session, with no question', async () => {
    vi.mocked(loadSessionEdit).mockResolvedValue({
      ok: true,
      values: editValues({ cancelled: true }),
      version: 'v1',
    })
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    const dialog = await openView(14, true)
    await act(async () => {
      await choose(dialog, en.SessionEdit.restoreSession)
    })
    expect(screen.queryByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })).toBeNull()
    await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1))
    expect(vi.mocked(saveScheduleEdits).mock.calls[0]![0].details).toEqual([
      expect.objectContaining({ values: expect.objectContaining({ cancelled: false }) }),
    ])
  })

  it('shows a refused save in the drawer', async () => {
    vi.mocked(loadSessionEdit).mockResolvedValue({ ok: true, values: editValues(), version: 'v1' })
    vi.mocked(saveScheduleEdits).mockResolvedValue({
      ok: false,
      error: { code: 'forbidden' },
    })
    const dialog = await openView(13, true)
    await choose(dialog, en.SessionEdit.cancelSession)
    const ask = await screen.findByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: en.SessionEdit.cancelSession }))
    })
    expect(await within(dialog).findByText(en.CalendarAdmin.errors.forbidden)).toBeInTheDocument()
    expect(scheduleOffers).not.toHaveBeenCalled()
  })
})

describe('the session drawer’s Edit form', () => {
  beforeEach(() => {
    vi.mocked(saveScheduleEdits).mockReset()
    vi.mocked(scheduleOffers).mockReset().mockResolvedValue([])
    refresh.mockReset()
  })

  it('offers Edit only to the people the session’s access lets edit', async () => {
    vi.mocked(loadSessionView).mockImplementation(async (id) => shown(Number(id), true))
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    await page()
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.edit })).toBeInTheDocument()
  })

  it('shows the meeting rule’s error by the end time, focuses it, and saves nothing', async () => {
    const dialog = await openForm(
      editValues({
        meetings: [{ id: 'm13', date: '2026-11-13', start_time: '21:00', end_time: '19:00' }],
      }),
    )
    await save(dialog)
    const error = await within(dialog).findByText(en.SessionEdit.errors.order)
    const ends = within(dialog).getByRole('button', { name: new RegExp(`^${en.SessionEdit.ends}`) })
    expect(ends).toHaveAttribute('data-invalid')
    expect(ends.getAttribute('aria-describedby')).toContain(error.id)
    await waitFor(() => expect(document.activeElement).toBe(ends))
    expect(saveScheduleEdits).not.toHaveBeenCalled()
  })

  it('adds a meeting, asks for its day, and removes it again', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.addMeeting }))
    expect(within(dialog).getAllByText(en.SessionEdit.day)).toHaveLength(2)
    await save(dialog)
    expect(await within(dialog).findByText(en.SessionEdit.errors.day)).toBeInTheDocument()
    expect(saveScheduleEdits).not.toHaveBeenCalled()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove meeting 2' }))
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    await save(dialog)
    expect(saveScheduleEdits).toHaveBeenCalledWith(
      {
        details: [
          {
            op: 'edit',
            id: '13',
            version: 'v1',
            values: (({ meetings: _, ...values }) => values)(editValues()),
            meetings: editValues().meetings,
          },
        ],
      },
      'en',
    )
  })

  it('asks before a close loses changes, and closes at once with none', async () => {
    const dialog = await openForm()
    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Walking the city' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    const ask = await screen.findByRole('dialog', { name: en.Spaces.calendarLeaveTitle })
    expect(window.location.search).toBe('?open=13')
    fireEvent.click(within(ask).getByRole('button', { name: en.Spaces.calendarLeaveStay }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.Spaces.calendarLeaveTitle })).toBeNull(),
    )

    fireEvent.change(within(dialog).getByRole('textbox', { name: en.SessionEdit.title }), {
      target: { value: 'Reading the city' },
    })
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(screen.queryByRole('dialog', { name: en.Spaces.calendarLeaveTitle })).toBeNull()

    // Opened again, it shows the session, not the form it was closed on.
    await act(async () => window.history.pushState(null, '', '/en/spaces/course/probe?open=13'))
    const again = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(await within(again).findByRole('button', { name: en.SessionEdit.edit })).toBeVisible()
    expect(within(again).queryByRole('textbox', { name: en.SessionEdit.title })).toBeNull()
  })

  it('after a save, offers on the course’s items before and after it, and reads the page again', async () => {
    const before = [
      {
        id: '13',
        kind: 'session',
        title: 'Reading the city',
        tone: 'yellow' as const,
        cancelled: false,
        version: 'v1',
        blocks: [{ id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' }],
      },
    ]
    const after = [{ ...before[0]!, cancelled: true, version: 'v2' }]
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: after, before, after })
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: en.SessionEdit.cancelled }))
    await save(dialog)
    await waitFor(() =>
      expect(scheduleOffers).toHaveBeenCalledWith({ courseId: '1', before, after }, 'en'),
    )
    expect(refresh).toHaveBeenCalled()
    // Back in view mode, read again.
    expect(await within(dialog).findByRole('button', { name: en.SessionEdit.edit })).toBeVisible()
    expect(loadSessionView).toHaveBeenCalledTimes(2)
  })

  it('keeps the changes on a stale save and offers to reload', async () => {
    vi.mocked(saveScheduleEdits).mockResolvedValue({
      ok: false,
      error: { code: 'stale', itemId: '13', name: 'Session 3: Reading the city' },
    })
    const dialog = await openForm()
    const title = within(dialog).getByRole('textbox', { name: en.SessionEdit.title })
    fireEvent.change(title, { target: { value: 'Mine' } })
    await save(dialog)
    expect(
      await within(dialog).findByRole('button', { name: en.CalendarAdmin.reloadAndLose }),
    ).toBeInTheDocument()
    expect(title).toHaveValue('Mine')
    expect(scheduleOffers).not.toHaveBeenCalled()
  })

  it('shows materials and activities as cards named for assistive tech, ending with a + tile', async () => {
    const dialog = await openForm()
    const material = within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' })
    expect(material).toHaveTextContent('Invisible Cities')
    expect(
      within(dialog).getByRole('button', { name: 'Edit activity: Discussion, In pairs' }),
    ).toBeInTheDocument()
    const tiles = within(dialog).getAllByRole('button', { name: /^Add (material|activity)$/ })
    expect(tiles.map((tile) => tile.getAttribute('aria-label'))).toEqual([
      'Add material',
      'Add activity',
    ])
    // The + row follows the list of cards, in the same block.
    const block = material.closest('ul')!.parentElement!
    expect(within(block).getAllByRole('button').at(-1)).toBe(tiles[0])
  })

  it('edits a material in its dialog; Done keeps it and Save sends it', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' }))
    const edit = await screen.findByRole('dialog', { name: en.SessionEdit.materialTitleEdit })
    // The first field takes focus, not the close button.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(edit).getByRole('combobox', { name: en.SessionEdit.materialType }),
      ),
    )
    fireEvent.change(within(edit).getByRole('textbox', { name: en.SessionEdit.materialTitle }), {
      target: { value: 'The Image of the City' },
    })
    fireEvent.change(within(edit).getByRole('textbox', { name: en.SessionEdit.materialLink }), {
      target: { value: 'https://www.example.org/lynch' },
    })
    fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.done }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
    )
    const card = within(dialog).getByRole('button', {
      name: 'Edit material: The Image of the City',
    })
    expect(card).toHaveTextContent('example.org')
    await waitFor(() => expect(document.activeElement).toBe(card))
    expect(saveScheduleEdits).not.toHaveBeenCalled()
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    await save(dialog)
    expect(vi.mocked(saveScheduleEdits).mock.calls[0]![0].details![0]).toMatchObject({
      values: {
        bibliography: [
          {
            id: 'b1',
            type: 'reading',
            title: 'The Image of the City',
            href: 'https://www.example.org/lynch',
            note: '',
          },
        ],
      },
    })
  })

  it('keeps the dialog open on an invalid material, names the fields and focuses the first', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' }))
    const edit = await screen.findByRole('dialog', { name: en.SessionEdit.materialTitleEdit })
    const title = within(edit).getByRole('textbox', { name: en.SessionEdit.materialTitle })
    fireEvent.change(title, { target: { value: '' } })
    fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.done }))
    expect(await within(edit).findByText(en.SessionEdit.errors.material)).toBeInTheDocument()
    expect(title).toHaveAttribute('aria-invalid', 'true')
    await waitFor(() => expect(document.activeElement).toBe(title))

    const link = within(edit).getByRole('textbox', { name: en.SessionEdit.materialLink })
    fireEvent.change(link, { target: { value: 'not a link' } })
    expect(await within(edit).findByText(en.SessionEdit.errors.link)).toBeInTheDocument()
    // Enter in a field is Done: it checks the dialog and never submits the session form.
    fireEvent.submit(link)
    expect(screen.getByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeVisible()
    expect(saveScheduleEdits).not.toHaveBeenCalled()

    // Cancel keeps the material as it was.
    fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.cancel }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
    )
    expect(
      within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' }),
    ).toBeInTheDocument()
  })

  it('adds a material from the + tile, and a cancelled new one adds nothing', async () => {
    const dialog = await openForm()
    const add = within(dialog).getByRole('button', { name: en.SessionEdit.addMaterial })
    fireEvent.click(add)
    let fresh = await screen.findByRole('dialog', { name: en.SessionEdit.addMaterial })
    expect(within(fresh).getByRole('textbox', { name: en.SessionEdit.materialTitle })).toHaveValue(
      '',
    )
    expect(within(fresh).queryByRole('button', { name: en.SessionEdit.removeMaterial })).toBeNull()
    fireEvent.click(within(fresh).getByRole('button', { name: en.SessionEdit.cancel }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.addMaterial })).toBeNull(),
    )
    expect(within(dialog).getAllByRole('button', { name: /^Edit material/ })).toHaveLength(1)
    await waitFor(() => expect(document.activeElement).toBe(add))

    fireEvent.click(add)
    fresh = await screen.findByRole('dialog', { name: en.SessionEdit.addMaterial })
    fireEvent.change(within(fresh).getByRole('textbox', { name: en.SessionEdit.materialLink }), {
      target: { value: 'https://soundcloud.com/cilas/walk' },
    })
    fireEvent.click(within(fresh).getByRole('button', { name: en.SessionEdit.done }))
    // A link alone is enough; the card shows its host.
    const card = await within(dialog).findByRole('button', {
      name: 'Edit material: soundcloud.com',
    })
    await waitFor(() => expect(document.activeElement).toBe(card))
  })

  describe('the order of materials', () => {
    const two = () =>
      editValues({
        bibliography: [
          { id: 'b1', type: 'reading', title: 'First', href: '', note: '' },
          { id: 'b2', type: 'watch', title: 'Second', href: '', note: '' },
          { id: 'b3', type: 'listen', title: 'Third', href: '', note: '' },
        ],
      })
    const openCard = async (dialog: HTMLElement, title: string) => {
      fireEvent.click(within(dialog).getByRole('button', { name: `Edit material: ${title}` }))
      return screen.findByRole('dialog', { name: en.SessionEdit.materialTitleEdit })
    }
    const titles = (dialog: HTMLElement) =>
      within(dialog)
        .getAllByRole('button', { name: /^Edit material/, hidden: true })
        .map((card) => card.getAttribute('aria-label'))

    it('has no Move up on the first item and no Move down on the last', async () => {
      const dialog = await openForm(two())
      let edit = await openCard(dialog, 'First')
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveUp })).toBeNull()
      expect(
        within(edit).getByRole('button', { name: en.SessionEdit.moveDown }),
      ).toBeInTheDocument()
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.cancel }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
      )
      edit = await openCard(dialog, 'Third')
      expect(within(edit).getByRole('button', { name: en.SessionEdit.moveUp })).toBeInTheDocument()
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveDown })).toBeNull()
    })

    it('shows neither button for a single item', async () => {
      const dialog = await openForm()
      const edit = await openCard(dialog, 'Invisible Cities')
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveUp })).toBeNull()
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveDown })).toBeNull()
    })

    it('moves the draft, announces the place, and Done applies it', async () => {
      const dialog = await openForm(two())
      const edit = await openCard(dialog, 'First')
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.moveDown }))
      expect(await within(edit).findByText('Position 2 of 3')).toHaveAttribute(
        'aria-live',
        'polite',
      )
      // Both buttons now, then the end of the list takes Move down away and focus moves on.
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.moveDown }))
      expect(await within(edit).findByText('Position 3 of 3')).toBeInTheDocument()
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveDown })).toBeNull()
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(edit).getByRole('button', { name: en.SessionEdit.moveUp }),
        ),
      )
      // The list itself does not change until Done.
      expect(titles(dialog)).toEqual([
        'Edit material: First',
        'Edit material: Second',
        'Edit material: Third',
      ])
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.done }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
      )
      await waitFor(() =>
        expect(titles(dialog)).toEqual([
          'Edit material: Second',
          'Edit material: Third',
          'Edit material: First',
        ]),
      )
      vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
      await save(dialog)
      const sent = vi.mocked(saveScheduleEdits).mock.calls[0]![0].details![0]
      expect(sent).toMatchObject({
        values: { bibliography: [{ id: 'b2' }, { id: 'b3' }, { id: 'b1' }] },
      })
    })

    it('drops a moved position on Cancel', async () => {
      const dialog = await openForm(two())
      const edit = await openCard(dialog, 'Second')
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.moveUp }))
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.cancel }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
      )
      expect(titles(dialog)[0]).toBe('Edit material: First')
    })

    it('starts a new item last and lets it move up', async () => {
      const dialog = await openForm(two())
      fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.addMaterial }))
      const edit = await screen.findByRole('dialog', { name: en.SessionEdit.addMaterial })
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveDown })).toBeNull()
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.moveUp }))
      expect(await within(edit).findByText('Position 3 of 4')).toBeInTheDocument()
      fireEvent.change(within(edit).getByRole('textbox', { name: en.SessionEdit.materialTitle }), {
        target: { value: 'New' },
      })
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.done }))
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: en.SessionEdit.addMaterial })).toBeNull(),
      )
      await waitFor(() =>
        expect(titles(dialog)).toEqual([
          'Edit material: First',
          'Edit material: Second',
          'Edit material: New',
          'Edit material: Third',
        ]),
      )
    })
  })

  it('removes a card from its dialog and gives focus to the next one or the + tile', async () => {
    const dialog = await openForm()
    fireEvent.click(
      within(dialog).getByRole('button', { name: 'Edit activity: Discussion, In pairs' }),
    )
    const edit = await screen.findByRole('dialog', { name: en.SessionEdit.activityTitleEdit })
    fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.removeActivity }))
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.activityTitleEdit })).toBeNull(),
    )
    expect(within(dialog).queryByRole('button', { name: /^Edit activity/ })).toBeNull()
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: en.SessionEdit.addActivity }),
      ),
    )
  })

  it('closes only the card dialog on Escape', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' }))
    const edit = await screen.findByRole('dialog', { name: en.SessionEdit.materialTitleEdit })
    fireEvent.keyDown(edit, { key: 'Escape' })
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeNull(),
    )
    expect(screen.getByRole('dialog', { name: 'Reading the city' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: en.SessionEdit.title })).toBeVisible()
  })

  it('names each meeting row as a group with its remove button', async () => {
    const dialog = await openForm(
      editValues({
        meetings: [
          { id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' },
          { id: 'm20', date: '2026-11-20', start_time: '19:00', end_time: '21:00' },
        ],
      }),
    )
    const second = within(dialog).getByRole('group', { name: 'Meeting 2' })
    expect(within(second).getByRole('button', { name: 'Remove meeting 2' })).toBeInTheDocument()
    expect(
      within(second).getByRole('button', { name: new RegExp(`^${en.SessionEdit.day}`) }),
    ).toBeInTheDocument()
    expect(
      within(second).getByRole('checkbox', { name: en.SessionEdit.allDay }),
    ).toBeInTheDocument()
  })

  it.each(['Cancel', 'Escape'])(
    'Enter opens confirmation with Cancel focused; %s changes nothing',
    async (action) => {
      const dialog = await openForm()
      const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
      await act(async () => {
        hold.focus()
        fireEvent.keyDown(hold, { key: 'Enter' })
      })
      const confirm = await screen.findByRole('dialog', { name: en.SessionEdit.deleteTitle })
      const cancel = within(confirm).getByRole('button', {
        name: en.SessionEdit.cancel,
      })
      expect(cancel).toHaveFocus()
      if (action === 'Cancel') fireEvent.click(cancel)
      else fireEvent.keyDown(cancel, { key: 'Escape' })
      await waitFor(() =>
        expect(screen.queryByRole('dialog', { name: en.SessionEdit.deleteTitle })).toBeNull(),
      )
      expect(saveScheduleEdits).not.toHaveBeenCalled()
      expect(hold).toHaveFocus()
    },
  )

  it.each([0, 1])(
    'a click without a hold (detail %s) opens confirmation; Delete calls the path once',
    async (detail) => {
      const dialog = await openForm()
      vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: false, error: { code: 'failed' } })
      const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
      await act(async () => {
        hold.focus()
        fireEvent.click(hold, { detail })
      })
      const confirm = await screen.findByRole('dialog', { name: en.SessionEdit.deleteTitle })
      await act(async () => {
        fireEvent.click(within(confirm).getByRole('button', { name: en.SessionEdit.delete }))
      })
      await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1))
      expect(saveScheduleEdits).toHaveBeenCalledWith(
        { details: [{ op: 'delete', id: '13', version: 'v1' }] },
        'en',
      )
      expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    },
  )

  it('a pointer hold deletes without opening confirmation', async () => {
    const dialog = await openForm()
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    hold.setPointerCapture = vi.fn()
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: false, error: { code: 'failed' } })
    fireEvent.pointerDown(hold, { isPrimary: true, button: 0, pointerId: 1, pointerType: 'mouse' })
    await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1), { timeout: 4000 })
    fireEvent.pointerUp(hold)
    fireEvent.click(hold, { detail: 1 })
    expect(screen.queryByRole('dialog', { name: en.SessionEdit.deleteTitle })).toBeNull()
  })

  it('shows Save changes, Cancel and a hold to delete; a full hold deletes at once', async () => {
    const dialog = await openForm()
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.save })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.apply })).toBeNull()
    // The footer row reads and tabs Cancel, then the primary action; the hold comes before it.
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    const button = (name: string) => within(dialog).getByRole('button', { name })
    expect(within(dialog).getAllByRole('button').slice(-3)).toEqual([
      hold,
      button(en.SessionEdit.cancel),
      button(en.SessionEdit.save),
    ])
    expect(hold).toHaveAccessibleDescription(en.SessionEdit.holdHint.replace('{seconds}', '1.2'))
    // An early release deletes nothing.
    fireEvent.keyDown(hold, { key: ' ' })
    fireEvent.keyUp(hold, { key: ' ' })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    expect(saveScheduleEdits).not.toHaveBeenCalled()

    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: true, items: [], before: [], after: [] })
    vi.mocked(loadSessionView).mockResolvedValue({ ok: false, error: 'not-found' })
    fireEvent.keyDown(hold, { key: ' ' })
    await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(saveScheduleEdits).toHaveBeenCalledWith(
      { details: [{ op: 'delete', id: '13', version: 'v1' }] },
      'en',
    )
    // Back in the view, read again: the session is gone.
    expect(await within(dialog).findByText(en.SpacePost.sessionGone)).toBeInTheDocument()
  })

  it('rewinds the hold and shows why when a delete is refused', async () => {
    vi.mocked(saveScheduleEdits).mockResolvedValue({ ok: false, error: { code: 'failed' } })
    const dialog = await openForm()
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    fireEvent.keyDown(hold, { key: ' ' })
    await waitFor(() => expect(saveScheduleEdits).toHaveBeenCalledTimes(1), { timeout: 4000 })
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })).toBeEnabled()
  })

  it('offers a retry when the session does not load', async () => {
    vi.mocked(loadSessionView).mockResolvedValueOnce({ ok: false, error: 'failed' })
    window.history.replaceState(null, '', '/en/spaces/course/probe?open=13')
    await page()
    fireEvent.click(await screen.findByRole('button', { name: en.SpacePost.sessionDrawerRetry }))
    expect(await screen.findByRole('dialog', { name: 'Reading the city' })).toBeInTheDocument()
  })
})
