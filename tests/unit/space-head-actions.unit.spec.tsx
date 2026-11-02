import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import type { ComponentProps, ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import messages from '../../messages/en.json'
import { SpaceHeadActions } from '@/components/space/space-head-actions'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }))

type OverlayProps = { open: boolean; onOpenChange: (open: boolean) => void }
function Panel({ open, onOpenChange, name }: OverlayProps & { name: string }) {
  return open ? (
    <div role="dialog" aria-label={name}>
      <button
        onClick={(event) => {
          event.currentTarget.blur()
          onOpenChange(false)
        }}
      >
        Close
      </button>
    </div>
  ) : null
}
vi.mock('@/components/arc/bottom-sheet/bottom-sheet', () => ({
  BottomSheet: (props: OverlayProps) => <Panel {...props} name="About" />,
}))
vi.mock('@/components/space/participation-dialog', () => ({
  ParticipationDialog: (props: OverlayProps) => <Panel {...props} name="Participation" />,
}))
vi.mock('@/components/space/space-settings', () => ({
  SpaceSettings: ({ anchor, ...props }: OverlayProps & { anchor: ReactNode }) => (
    <>
      {anchor}
      <Panel {...props} name="Settings" />
    </>
  ),
}))

const mount = (props: Partial<ComponentProps<typeof SpaceHeadActions>> = {}) =>
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <SpaceHeadActions
        coursePage={null}
        rail={<p>About this space</p>}
        participation={null}
        now="2026-10-27T12:00:00Z"
        settings={null}
        {...props}
      />
    </NextIntlClientProvider>,
  )

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  push.mockClear()
})

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
    vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get').mockReturnValue(document.body)
    mount()
    const about = screen.getByRole('button', { name: messages.Spaces.about })
    fireEvent.click(about)
    expect(screen.getByRole('dialog', { name: 'About' })).toBeInTheDocument()
    const close = screen.getByRole('button', { name: 'Close' })
    close.focus()
    fireEvent.click(close)
    await waitFor(() => expect(about).toHaveFocus())
  })

  it('keeps moderator actions wired and keyboard reachable in RTL', () => {
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
    expect(participation).toHaveFocus()
    fireEvent.click(participation)
    expect(screen.getByRole('dialog', { name: 'Participation' })).toBeInTheDocument()
    fireEvent.keyDown(participation, { key: 'End' })
    expect(settings).toHaveFocus()
    fireEvent.click(settings)
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument()
  })
})
