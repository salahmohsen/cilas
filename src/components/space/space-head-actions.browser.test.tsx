import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { page } from 'vitest/browser'

import { SpaceHeadActions } from '@/components/space/space-head-actions'

import messages from '../../../messages/en.json'
import { IntlProvider } from '../../../testing/intl.test-utils'
import { renderWithNavigation } from '../../../testing/navigation.test-utils'

const mount = (props: Partial<ComponentProps<typeof SpaceHeadActions>> = {}) =>
  renderWithNavigation(
    <IntlProvider>
      <SpaceHeadActions
        coursePage={null}
        rail={<p>About this space</p>}
        participation={null}
        now="2026-10-27T12:00:00Z"
        settings={null}
        {...props}
      />
    </IntlProvider>,
  )

beforeEach(() => page.viewport(390, 844))
afterEach(cleanup)

describe('space header actions', () => {
  it('keeps moderator controls and course navigation absent when unavailable', () => {
    mount()
    expect(screen.getAllByRole('toolbar')).toHaveLength(1)
    expect(screen.getByRole('button', { name: messages.Spaces.about })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: messages.Spaces.settingsForModerator })).toBeNull()
    expect(screen.queryByRole('button', { name: messages.Participation.title })).toBeNull()
    expect(screen.queryByRole('button', { name: messages.Spaces.coursePage })).toBeNull()
  })

  it('links to the course page from the strip', () => {
    mount({ coursePage: '/en/study/example' })
    expect(screen.getByRole('link', { name: messages.Spaces.coursePage })).toHaveProperty(
      'href',
      expect.stringContaining('/en/study/example'),
    )
  })

  it('opens About and returns focus to its action on close', async () => {
    mount()
    const about = screen.getByRole('button', { name: messages.Spaces.about })
    fireEvent.click(about)
    expect(screen.getByRole('dialog', { name: messages.Spaces.about })).toBeInTheDocument()
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    fireEvent.click(close)
    await waitFor(() => expect(about).toHaveFocus())
  })

  it('keeps moderator actions wired and keyboard reachable in RTL', async () => {
    mount({
      participation: { rows: [], weeks: [] },
      settings: {
        space: 1,
        posting: 'open',
        events: 'members',
        archived: false,
        about: '',
        aboutDefault: '',
        rules: '',
        rulesDefault: '',
        save: async () => ({ status: 'ok' }),
      },
    })
    const toolbar = screen.getAllByRole('toolbar', { name: messages.Spaces.spaceActions })[0]!
    toolbar.style.direction = 'rtl'
    const about = within(toolbar).getByRole('button', { name: messages.Spaces.about })
    const participation = within(toolbar).getByRole('button', {
      name: messages.Participation.title,
    })
    const settings = within(toolbar).getByRole('button', {
      name: messages.Spaces.settingsForModerator,
    })
    about.focus()
    fireEvent.keyDown(about, { key: 'ArrowLeft' })
    await waitFor(() => expect(participation).toHaveFocus())
    fireEvent.click(participation)
    expect(screen.getByRole('dialog', { name: messages.Participation.title })).toBeInTheDocument()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    participation.focus()
    fireEvent.keyDown(participation, { key: 'End' })
    await waitFor(() => expect(settings).toHaveFocus())
    fireEvent.click(settings)
    expect(
      screen.getByRole('dialog', { name: messages.Spaces.settingsForModerator }),
    ).toBeInTheDocument()
  })
})
