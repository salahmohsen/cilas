import type { ReactElement, ReactNode } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { NextIntlClientProvider } from 'next-intl'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import messages from '../../messages/en.json'
import { VotePoll } from '@/components/space/vote-poll'
import type { VoteView, Voter } from '@/lib/spaces-data'
import type { SpacesWriteState } from '@/lib/space-actions'

const { save, refresh } = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }))
vi.mock('@/lib/space-actions', () => ({ voteSetAction: save }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('motion/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('motion/react')>()),
  AnimatePresence: ({ children }: { children: ReactNode }) => children,
}))
vi.mock('@/lib/use-narrow', () => ({ useNarrow: () => false }))
vi.mock('@/components/space/composer', () => ({ saveErrorKey: () => 'saveError_failed' }))
vi.mock('@/components/space/person-hover', () => ({
  PersonHover: ({ children }: { children: ReactElement }) => children,
}))

const me: Voter = { personId: 7, name: 'Mona', photo: '/mona.webp' }
const other: Voter = { personId: 8, name: 'Nadim', photo: null }
const viewer = { personId: me.personId, moderator: false, me: { name: me.name, photo: me.photo } }
let finish: (result: SpacesWriteState) => void

beforeEach(() => {
  save.mockReset()
  refresh.mockClear()
  save.mockReturnValue(
    new Promise<SpacesWriteState>((resolve) => {
      finish = resolve
    }),
  )
})
afterEach(cleanup)

function poll(overrides: Partial<VoteView> = {}) {
  const vote: VoteView = {
    multiple: false,
    anonymous: false,
    options: [
      { id: 'tea', label: 'Tea', count: 1, voters: [other] },
      { id: 'coffee', label: 'Coffee', count: 0, voters: [] },
    ],
    voters: 1,
    mine: [],
    closesAt: null,
    closed: false,
    severalHeld: false,
    ...overrides,
  }
  render(
    <NextIntlClientProvider locale="en" messages={messages}>
      <VotePoll post={1} vote={vote} viewer={viewer} disabled={false} />
    </NextIntlClientProvider>,
  )
}

const option = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name},`) })
const group = (name: string) => screen.getByRole('group', { name: `Chose ${name}` })
const selected: Partial<VoteView> = {
  mine: ['tea'],
  voters: 2,
  options: [
    { id: 'tea', label: 'Tea', count: 2, voters: [other, me] },
    { id: 'coffee', label: 'Coffee', count: 0, voters: [] },
  ],
}
async function failSave() {
  await act(async () => {
    finish({ status: 'error', error: 'failed' })
  })
}

describe('optimistic poll avatars', () => {
  it('adds the member photo while saving and rolls it back with the choice on failure', async () => {
    poll()
    fireEvent.click(option('Coffee'))
    const avatar = await within(
      await screen.findByRole('group', { name: 'Chose Coffee' }),
    ).findByRole('img', { name: 'Mona' })
    expect(avatar.querySelector('img')).toHaveAttribute('src', '/mona.webp')
    expect(option('Coffee')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('2 members voted')).toBeInTheDocument()
    await failSave()
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Chose Coffee' })).not.toBeInTheDocument(),
    )
    expect(option('Coffee')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1 member voted')).toBeInTheDocument()
  })

  it('moves the avatar between single-choice options and restores it on failure', async () => {
    poll(selected)
    fireEvent.click(option('Coffee'))
    await within(await screen.findByRole('group', { name: 'Chose Coffee' })).findByRole('img', {
      name: 'Mona',
    })
    await waitFor(() =>
      expect(within(group('Tea')).queryByRole('img', { name: 'Mona' })).not.toBeInTheDocument(),
    )
    expect(within(group('Tea')).getByRole('img', { name: 'Nadim' })).toBeInTheDocument()
    expect(screen.getByText('2 members voted')).toBeInTheDocument()
    await failSave()
    await within(group('Tea')).findByRole('img', { name: 'Mona' })
    await waitFor(() =>
      expect(screen.queryByRole('group', { name: 'Chose Coffee' })).not.toBeInTheDocument(),
    )
  })

  it('removes the avatar when withdrawing and restores it on failure', async () => {
    poll(selected)
    fireEvent.click(option('Tea'))
    await waitFor(() =>
      expect(within(group('Tea')).queryByRole('img', { name: 'Mona' })).not.toBeInTheDocument(),
    )
    expect(option('Tea')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByText('1 member voted')).toBeInTheDocument()
    await failSave()
    await within(group('Tea')).findByRole('img', { name: 'Mona' })
    expect(option('Tea')).toHaveAttribute('aria-pressed', 'true')
  })

  it('keeps one avatar on each selected option in a multiple-choice poll', async () => {
    poll({ ...selected, multiple: true })
    fireEvent.click(option('Coffee'))
    await within(await screen.findByRole('group', { name: 'Chose Coffee' })).findByRole('img', {
      name: 'Mona',
    })
    expect(within(group('Tea')).getAllByRole('img', { name: 'Mona' })).toHaveLength(1)
    expect(screen.getByText('2 members voted')).toBeInTheDocument()
    await failSave()
  })

  it('never shows an avatar for an anonymous vote, including while saving', async () => {
    poll({
      anonymous: true,
      options: [
        { id: 'tea', label: 'Tea', count: 1, voters: [] },
        { id: 'coffee', label: 'Coffee', count: 0, voters: [] },
      ],
    })
    fireEvent.click(option('Coffee'))
    expect(option('Coffee')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
    expect(screen.queryByRole('group')).not.toBeInTheDocument()
    await failSave()
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
