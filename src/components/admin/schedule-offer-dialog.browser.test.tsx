import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { calendarAdminText } from '@/components/admin/calendar-admin-text'
import { ScheduleOfferDialog } from '@/components/space/schedule-offer-dialog'
import type { ScheduleOffer } from '@/lib/schedule-offer'
import { scheduleToken } from '@/lib/session-refs'
import type { SpacesWriteState } from '@/lib/space-actions'

import en from '../../../messages/en.json'

const server = (answer: () => Promise<SpacesWriteState> = async () => ({ status: 'ok' })) => {
  const posts: FormData[] = []
  const publish = (form: FormData) => {
    posts.push(form)
    return answer()
  }
  const sent = () => {
    const form = posts.at(-1)!
    return { space: form.get('space'), kind: form.get('kind'), body: String(form.get('body')) }
  }
  return { posts, publish, sent }
}

const postErrors = Object.fromEntries(
  Object.entries(en.SpacePost).filter(([key]) => key.startsWith('saveError_')),
)
const { offerLabels } = calendarAdminText('en', {
  CalendarUi: en.CalendarUi,
  CalendarAdmin: en.CalendarAdmin,
  SpacePost: postErrors,
}).save

const TOKEN = scheduleToken({ from: '2026-11-14', weeks: 1, ids: ['3'] })
const TEXT = '- Session 3: Reading Fanon moves from Thu 19 Nov 19:00 to Sat 21 Nov 20:00'

const offer = (id: number, name: string, extra: Partial<ScheduleOffer> = {}) =>
  ({
    space: { id, name },
    language: 'en',
    text: TEXT,
    block: TOKEN,
    preview: {
      items: [
        {
          id: '3',
          kind: 'session',
          title: 'Reading Fanon',
          tone: 'green',
          cancelled: false,
          version: 'v',
          blocks: [{ id: 'a', date: '2026-11-21', start_time: '20:00', end_time: '22:00' }],
        },
      ],
      marked: ['3'],
      day: '2026-11-21',
    },
    ...extra,
  }) satisfies ScheduleOffer

const show = (offers: ScheduleOffer[], publish = server().publish, onClose = vi.fn()) => {
  render(
    <ScheduleOfferDialog
      offers={offers}
      labels={offerLabels}
      locale="en"
      dir="ltr"
      onClose={onClose}
      returnFocus={() => null}
      publish={publish}
    />,
  )
  return onClose
}

beforeEach(() => {
  localStorage.clear()
  vi.useFakeTimers({ now: new Date('2026-11-17T10:00:00Z'), toFake: ['Date'] })
})
afterEach(() => {
  vi.useRealTimers()
  cleanup()
})

describe('the schedule offer dialog', () => {
  it('opens with the announcement written, the space named and the calendar box on', async () => {
    show([offer(7, 'Reading group')])
    const dialog = await screen.findByRole('dialog', { name: 'Announce this change?' })
    expect(dialog).toHaveAccessibleDescription(
      'The announcement goes to Reading group, pinned, and every member gets a notification.',
    )
    expect(within(dialog).getByRole('textbox', { name: 'Announcement' })).toHaveTextContent(
      'Session 3: Reading Fanon moves from Thu 19 Nov 19:00 to Sat 21 Nov 20:00',
    )
    expect(dialog.textContent).not.toContain('::schedule')
    expect(within(dialog).getByRole('checkbox', { name: 'Include the calendar' })).toBeChecked()
    expect(dialog.querySelector('figure [data-marked]')).not.toBeNull()
    expect(within(dialog).queryByRole('heading', { name: /^To / })).toBeNull()
  })

  it('publishes an announcement with the block as its own paragraph, then closes', async () => {
    const { publish, sent } = server()
    const onClose = show([offer(7, 'Reading group')], publish)
    fireEvent.click(await screen.findByRole('button', { name: 'Publish to space' }))
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(sent()).toEqual({ space: '7', kind: 'announcement', body: `${TEXT}\n\n${TOKEN}` })
  })

  it('leaves the block out when the box is off', async () => {
    const { publish, posts, sent } = server()
    show([offer(7, 'Reading group')], publish)
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Include the calendar' }))
    expect(document.querySelector('figure')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Publish to space' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(sent().body).toBe(TEXT)
  })

  it('has no box and no preview when there is no block', async () => {
    const { publish, posts, sent } = server()
    show([offer(7, 'Reading group', { block: null, preview: null })], publish)
    await screen.findByRole('dialog')
    expect(screen.queryByRole('checkbox')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Publish to space' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(sent().body).toBe(TEXT)
  })

  it('Skip closes it and posts nothing', async () => {
    const { publish, posts } = server()
    const onClose = show([offer(7, 'Reading group')], publish)
    fireEvent.click(await screen.findByRole('button', { name: 'Skip' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(posts).toHaveLength(0)
  })

  it('keeps the text and shows why when the publish fails', async () => {
    const { publish } = server(async () => ({ status: 'error', error: 'consent' }))
    const onClose = show([offer(7, 'Reading group')], publish)
    fireEvent.click(await screen.findByRole('button', { name: 'Publish to space' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      `The announcement is not published. ${en.SpacePost.saveError_consent}`,
    )
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole('textbox', { name: 'Announcement' })).toHaveTextContent(
      'Session 3: Reading Fanon moves',
    )
    expect(screen.getByRole('button', { name: 'Publish to space' })).toBeEnabled()
  })

  it('shows a failure of the request itself as a failed publish', async () => {
    const { publish } = server(() => Promise.reject(new Error('network')))
    show([offer(7, 'Reading group')], publish)
    fireEvent.click(await screen.findByRole('button', { name: 'Publish to space' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(en.SpacePost.saveError_failed)
  })

  it('gives each of several spaces its own entry, and closes when all are done', async () => {
    const { publish, posts, sent } = server()
    const onClose = show([offer(7, 'Reading group'), offer(8, 'Second course')], publish)
    const dialog = await screen.findByRole('dialog')
    expect(dialog).not.toHaveAccessibleDescription()
    const first = within(dialog).getByRole('region', { name: 'To Reading group' })
    const second = within(dialog).getByRole('region', { name: 'To Second course' })
    expect(within(first).getByRole('textbox', { name: 'Announcement' })).toBeInTheDocument()
    expect(within(second).getByRole('textbox', { name: 'Announcement' })).toBeInTheDocument()

    fireEvent.click(within(second).getByRole('button', { name: 'Skip' }))
    expect(screen.queryByRole('region', { name: 'To Second course' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
    fireEvent.click(
      within(screen.getByRole('region', { name: 'To Reading group' })).getByRole('button', {
        name: 'Publish to space',
      }),
    )
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
    expect(sent().space).toBe('7')
    expect(posts).toHaveLength(1)
  })
})

it('publishes one space and skips the other without a second dialog', async () => {
  const { publish, posts, sent } = server()
  const onClose = show([offer(7, 'Reading group'), offer(8, 'Second course')], publish)
  const dialog = await screen.findByRole('dialog')
  fireEvent.click(
    within(screen.getByRole('region', { name: 'To Reading group' })).getByRole('button', {
      name: 'Publish to space',
    }),
  )
  await waitFor(() => expect(screen.queryByRole('region', { name: 'To Reading group' })).toBeNull())
  expect(onClose).not.toHaveBeenCalled()
  expect(screen.getAllByRole('dialog')).toEqual([dialog])
  fireEvent.click(
    within(screen.getByRole('region', { name: 'To Second course' })).getByRole('button', {
      name: 'Skip',
    }),
  )
  expect(onClose).toHaveBeenCalledTimes(1)
  expect(posts).toHaveLength(1)
  expect(sent().space).toBe('7')
})
