import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { page as browser, userEvent } from 'vitest/browser'

import type { SessionViewResult } from '@/actions/load-session-view'
import { ScheduleActionsProvider, type ScheduleActions } from '@/components/space/schedule-actions'
import {
  SessionDrawerHost,
  SessionLink,
  sessionTriggerProps,
} from '@/components/space/session-drawer-host'
import { numberedSessions } from '@/lib/meetings'
import type { SessionEdit } from '@/lib/session-edit'
import type { Session } from '@/payload-types'

import ar from '../../messages/ar.json'
import en from '../../messages/en.json'
import { IntlProvider } from '../../testing/intl.test-utils'
import { scheduleActionsHost } from '../../testing/schedule-actions.test-utils'
import { renderWithBrowserNavigation } from '../../testing/browser-navigation.test-utils'

type Saved = Awaited<ReturnType<ScheduleActions['saveScheduleEdits']>>
type Loaded = Awaited<ReturnType<ScheduleActions['loadSessionEdit']>>

const session = (id: number, position: number, extra: Partial<Session> = {}) =>
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
const shown = (id: number, canEdit = false) =>
  ({
    ok: true,
    course: course as never,
    session: numberedSessions(sessions).find((n) => n.session.id === id)!,
    spaceHref: '/en/spaces/course/probe',
    canEdit,
  }) satisfies SessionViewResult

const deferred = () => {
  let resolve!: () => void
  const promise = new Promise<void>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

const defaults: {
  view: (id: string) => Promise<SessionViewResult>
  save: () => Promise<Saved>
  edit: () => Promise<Loaded>
} = {
  view: async (id) => shown(Number(id)),
  save: async () => ({ ok: true, items: [], before: [], after: [] }),
  edit: async () => ({ ok: false, error: 'failed' }),
}

const host = {
  saved: deferred(),
  views: [] as Array<Parameters<ScheduleActions['loadSessionView']>>,
  saves: [] as Array<Parameters<ScheduleActions['saveScheduleEdits']>>,
  offers: [] as Array<Parameters<ScheduleActions['scheduleOffers']>>,
  edits: [] as Array<Parameters<ScheduleActions['loadSessionEdit']>>,
  ...defaults,
}

const actions = {
  ...scheduleActionsHost().actions,
  loadSessionView: async (...args) => {
    host.views.push(args)
    return host.view(args[0])
  },
  saveScheduleEdits: async (...args) => {
    host.saves.push(args)
    host.saved.resolve()
    return host.save()
  },
  scheduleOffers: async (...args) => {
    host.offers.push(args)
    return []
  },
  loadSessionEdit: async (...args) => {
    host.edits.push(args)
    return host.edit()
  },
} satisfies ScheduleActions

let router: ReturnType<typeof renderWithBrowserNavigation>['browser']

const page = async (locale: 'en' | 'ar' = 'en') =>
  act(async () => {
    router = renderWithBrowserNavigation(
      <IntlProvider locale={locale}>
        <ScheduleActionsProvider actions={actions}>
          <SessionLink id="13" href="/en/spaces/course/probe?tab=syllabus&open=13">
            {en.SpacePost.sessionOpen}
          </SessionLink>
          <SessionDrawerHost />
        </ScheduleActionsProvider>
      </IntlProvider>,
    ).browser
  })

const phone = () => browser.viewport(390, 844)

beforeAll(async () => {
  sessionTriggerProps.onPointerEnter()
  await import('@/components/space/session-drawer')
  await import('@/components/space/session-form')
})
beforeEach(() => {
  Object.assign(host, defaults)
  host.saved = deferred()
  host.views.length = 0
  host.saves.length = 0
  host.offers.length = 0
  host.edits.length = 0
  window.history.replaceState(null, '', '?tab=syllabus')
})
afterEach(() => {
  cleanup()
})

describe('the session drawer', () => {
  it.each(['en', 'ar'] as const)('names the sheet controls in %s', async (locale) => {
    await phone()
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
      if (onPhone) await phone()
      host.view = async (id) => shown(Number(id), true)
      window.history.replaceState(null, '', '?open=13')
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
        ].slice(-3),
      ).toEqual([
        edit,
        posts,
        within(dialog).getByRole('button', { name: en.CalendarUi.moreActions }),
      ])
    },
  )

  it('is not in the page until a session is opened', async () => {
    await page()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(host.views).toHaveLength(0)
  })

  it('opens on a click with the param, takes focus, closes on Escape, and gives focus back', async () => {
    await page()
    const link = screen.getByRole('link', { name: en.SpacePost.sessionOpen })
    link.focus()
    await act(async () => {
      fireEvent.click(link)
    })
    expect(window.location.search).toBe('?tab=syllabus&open=13')

    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(host.views).toContainEqual(['13', 'en'])
    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))
    expect(within(dialog).getByText(en.SpacePost.sessionDrawerTimes)).toBeInTheDocument()

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
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.edit })).toBeNull()

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    await waitFor(() => expect(window.location.search).toBe('?tab=syllabus'))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(document.activeElement).toBe(link)
  })

  it('opens from a link with the param and drops the param in place on close', async () => {
    window.history.replaceState(null, '', '?open=14')
    const length = window.history.length
    await page()
    const dialog = await screen.findByRole('dialog', { name: 'Called off' })
    expect(within(dialog).getAllByText(en.Course.cancelled).length).toBeGreaterThan(0)
    fireEvent.click(within(dialog).getByRole('button', { name: en.SpacePost.sessionDrawerClose }))
    await waitFor(() => expect(window.location.search).toBe(''))
    expect(window.history.length).toBe(length)
  })

  it('says so when the session is gone or not the reader’s to read', async () => {
    host.view = async () => ({ ok: false, error: 'not-found' })
    window.history.replaceState(null, '', '?open=99')
    await page()
    expect(await screen.findByText(en.SpacePost.sessionGone)).toBeInTheDocument()
  })

  it('slides from the left in Arabic, with Arabic labels', async () => {
    window.history.replaceState(null, '', '?open=13')
    host.view = async (id) => shown(Number(id))
    await page('ar')
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).toHaveAttribute('data-side', 'left')
    expect(
      within(dialog).getByRole('button', { name: ar.SpacePost.sessionDrawerClose }),
    ).toBeInTheDocument()
  })

  it('is a bottom sheet on a phone', async () => {
    await phone()
    window.history.replaceState(null, '', '?open=13')
    await page()
    const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
    expect(dialog).not.toHaveAttribute('data-side')
    expect(screen.getByRole('button', { name: /^(Expand|Collapse) sheet$/ })).toBeInTheDocument()
    await act(async () => {})
  })
})

const editValues = (extra: Partial<SessionEdit> = {}) =>
  ({
    title: 'Reading the city',
    description: 'Walk **slowly**.',
    cancelled: false,
    meetings: [{ id: 'm13', date: '2026-11-13', start_time: '19:00', end_time: '21:00' }],
    bibliography: [{ id: 'b1', type: 'reading', title: 'Invisible Cities', href: '', note: '' }],
    activities: [{ id: 'a1', kind: 'discussion', description: 'In pairs' }],
    ...extra,
  }) satisfies SessionEdit

const openForm = async (values = editValues()) => {
  host.view = async (id) => shown(Number(id), true)
  host.edit = async () => ({ ok: true, values, version: 'v1' })
  window.history.replaceState(null, '', '?open=13')
  await page()
  const dialog = await screen.findByRole('dialog', { name: 'Reading the city' })
  const edit = await within(dialog).findByRole('button', { name: en.SessionEdit.edit })
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
  const openView = async (id: number, canEdit: boolean) => {
    host.view = async () => shown(id, canEdit)
    window.history.replaceState(null, '', `?open=${id}`)
    await page()
    return screen.findByRole('dialog')
  }
  const choose = async (dialog: HTMLElement, name: string) => {
    const more = await within(dialog).findByRole('button', { name: en.CalendarUi.moreActions })
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
    expect(within(dialog).queryByRole('button', { name: en.CalendarUi.moreActions })).toBeNull()
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
    expect(host.saves).toHaveLength(0)
  })

  it('cancels through the one save path, offers the announcement, and reads the view again', async () => {
    host.edit = async () => ({ ok: true, values: editValues(), version: 'v1' })
    host.save = async () => ({ ok: true, items: [], before: [], after: [] })
    const dialog = await openView(13, true)
    await choose(dialog, en.SessionEdit.cancelSession)
    const ask = await screen.findByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })
    await act(async () => {
      fireEvent.click(within(ask).getByRole('button', { name: en.SessionEdit.cancelSession }))
    })
    expect(host.saves).toHaveLength(1)
    const [{ details }] = host.saves[0]!
    expect(details).toEqual([
      expect.objectContaining({
        op: 'edit',
        id: '13',
        values: expect.objectContaining({ cancelled: true }),
      }),
    ])
    expect(host.offers).toEqual([[expect.objectContaining({ courseId: '1' }), 'en']])
    expect(router.refreshes).toBeGreaterThan(0)
  })

  it('offers Restore session for a cancelled session, with no question', async () => {
    host.edit = async () => ({
      ok: true,
      values: editValues({ cancelled: true }),
      version: 'v1',
    })
    host.save = async () => ({ ok: true, items: [], before: [], after: [] })
    const dialog = await openView(14, true)
    await act(async () => {
      await choose(dialog, en.SessionEdit.restoreSession)
    })
    expect(screen.queryByRole('dialog', { name: en.SessionEdit.cancelSessionTitle })).toBeNull()
    await host.saved.promise
    expect(host.saves[0]![0].details).toEqual([
      expect.objectContaining({ values: expect.objectContaining({ cancelled: false }) }),
    ])
  })

  it('shows a refused save in the drawer', async () => {
    host.edit = async () => ({ ok: true, values: editValues(), version: 'v1' })
    host.save = async () => ({
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
    expect(host.offers).toHaveLength(0)
  })
})

describe('the session drawer’s Edit form', () => {
  it('offers Edit only to the people the session’s access lets edit', async () => {
    host.view = async (id) => shown(Number(id), true)
    window.history.replaceState(null, '', '?open=13')
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
    expect(host.saves).toHaveLength(0)
  })

  it('adds a meeting, asks for its day, and removes it again', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: en.SessionEdit.addMeeting }))
    expect(within(dialog).getAllByText(en.SessionEdit.day)).toHaveLength(2)
    await save(dialog)
    expect(await within(dialog).findByText(en.SessionEdit.errors.day)).toBeInTheDocument()
    expect(host.saves).toHaveLength(0)

    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove meeting 2' }))
    host.save = async () => ({ ok: true, items: [], before: [], after: [] })
    await save(dialog)
    expect(host.saves).toEqual([
      [
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
      ],
    ])
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

    await act(async () => window.history.pushState(null, '', '?open=13'))
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
    host.save = async () => ({ ok: true, items: after, before, after })
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('checkbox', { name: en.SessionEdit.cancelled }))
    await save(dialog)
    await waitFor(() => expect(host.offers).toEqual([[{ courseId: '1', before, after }, 'en']]))
    expect(router.refreshes).toBeGreaterThan(0)
    expect(await within(dialog).findByRole('button', { name: en.SessionEdit.edit })).toBeVisible()
    expect(host.views).toHaveLength(2)
  })

  it('keeps the changes on a stale save and offers to reload', async () => {
    host.save = async () => ({
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
    expect(host.offers).toHaveLength(0)
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
    const block = material.closest('ul')!.parentElement!
    expect(within(block).getAllByRole('button').at(-1)).toBe(tiles[0])
  })

  it('edits a material in its dialog; Done keeps it and Save sends it', async () => {
    const dialog = await openForm()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Edit material: Invisible Cities' }))
    const edit = await screen.findByRole('dialog', { name: en.SessionEdit.materialTitleEdit })
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
    expect(host.saves).toHaveLength(0)
    host.save = async () => ({ ok: true, items: [], before: [], after: [] })
    await save(dialog)
    expect(host.saves[0]![0].details![0]).toMatchObject({
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
    fireEvent.submit(link)
    await waitFor(() =>
      expect(screen.getByRole('dialog', { name: en.SessionEdit.materialTitleEdit })).toBeVisible(),
    )
    expect(host.saves).toHaveLength(0)

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
      fireEvent.click(within(edit).getByRole('button', { name: en.SessionEdit.moveDown }))
      expect(await within(edit).findByText('Position 3 of 3')).toBeInTheDocument()
      expect(within(edit).queryByRole('button', { name: en.SessionEdit.moveDown })).toBeNull()
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(edit).getByRole('button', { name: en.SessionEdit.moveUp }),
        ),
      )
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
      host.save = async () => ({ ok: true, items: [], before: [], after: [] })
      await save(dialog)
      const sent = host.saves[0]![0].details![0]
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
      expect(host.saves).toHaveLength(0)
      expect(hold).toHaveFocus()
    },
  )

  it.each([0, 1])(
    'a click without a hold (detail %s) opens confirmation; Delete calls the path once',
    async (detail) => {
      const dialog = await openForm()
      host.save = async () => ({ ok: false, error: { code: 'failed' } })
      const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
      await act(async () => {
        hold.focus()
        fireEvent.click(hold, { detail })
      })
      const confirm = await screen.findByRole('dialog', { name: en.SessionEdit.deleteTitle })
      await act(async () => {
        fireEvent.click(within(confirm).getByRole('button', { name: en.SessionEdit.delete }))
      })
      await host.saved.promise
      expect(host.saves).toEqual([[{ details: [{ op: 'delete', id: '13', version: 'v1' }] }, 'en']])
      expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    },
  )

  it('a pointer hold deletes without opening confirmation', async () => {
    const dialog = await openForm()
    host.save = async () => ({ ok: false, error: { code: 'failed' } })
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    await userEvent.click(hold, { delay: 1500 })
    expect(host.saves).toHaveLength(1)
    expect(screen.queryByRole('dialog', { name: en.SessionEdit.deleteTitle })).toBeNull()
  })

  it('shows Save changes, Cancel and a hold to delete; a full hold deletes at once', async () => {
    const dialog = await openForm()
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.save })).toBeInTheDocument()
    expect(within(dialog).queryByRole('button', { name: en.SessionEdit.apply })).toBeNull()
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    const button = (name: string) => within(dialog).getByRole('button', { name })
    expect(within(dialog).getAllByRole('button').slice(-3)).toEqual([
      hold,
      button(en.SessionEdit.cancel),
      button(en.SessionEdit.save),
    ])
    expect(hold).toHaveAccessibleDescription(en.SessionEdit.holdHint.replace('{seconds}', '1.2'))
    fireEvent.keyDown(hold, { key: ' ' })
    await waitFor(() => expect(hold).toHaveAttribute('data-state', 'holding'))
    fireEvent.keyUp(hold, { key: ' ' })
    await waitFor(() => expect(hold).toHaveAttribute('data-state', 'idle'))
    expect(host.saves).toHaveLength(0)

    host.save = async () => ({ ok: true, items: [], before: [], after: [] })
    host.view = async () => ({ ok: false, error: 'not-found' })
    fireEvent.keyDown(hold, { key: ' ' })
    await host.saved.promise
    expect(host.saves).toEqual([[{ details: [{ op: 'delete', id: '13', version: 'v1' }] }, 'en']])
    expect(await within(dialog).findByText(en.SpacePost.sessionGone)).toBeInTheDocument()
  })

  it('rewinds the hold and shows why when a delete is refused', async () => {
    host.save = async () => ({ ok: false, error: { code: 'failed' } })
    const dialog = await openForm()
    const hold = within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })
    fireEvent.keyDown(hold, { key: ' ' })
    await host.saved.promise
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: en.SessionEdit.holdDelete })).toBeEnabled()
  })

  it('offers a retry when the session does not load', async () => {
    host.view = async () => {
      host.view = defaults.view
      return { ok: false, error: 'failed' }
    }
    window.history.replaceState(null, '', '?open=13')
    await page()
    fireEvent.click(await screen.findByRole('button', { name: en.SpacePost.sessionDrawerRetry }))
    expect(await screen.findByRole('dialog', { name: 'Reading the city' })).toBeInTheDocument()
  })
})
