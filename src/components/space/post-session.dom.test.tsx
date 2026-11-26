import { cleanup, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { PostSession } from '@/components/space/post-session'
import type { SessionCourse } from '@/lib/spaces-data'

import messages from '../../../messages/en.json'
import { renderWithIntl } from '../../../testing/intl.test-utils'

const course = {
  id: 1,
  slug: 'probe',
  title: 'Probe',
  course_type: 'LAB',
  sessions: [
    {
      id: 11,
      course: 1,
      position: 1,
      title: 'Probe session',
      cancelled: false,
      meetings: [],
      updatedAt: '2026-11-01T00:00:00.000Z',
      createdAt: '2026-11-01T00:00:00.000Z',
    },
  ],
} as unknown as SessionCourse

const mount = (ai: boolean) =>
  renderWithIntl(
    <PostSession
      session={{ state: 'shown', course, session: '11', ai }}
      kind="announcement"
      postHref=""
    />,
  )

const buttons = () => screen.queryByRole('toolbar', { name: messages.Share.aiSession })
const instructions = () => screen.queryByRole('button', { name: messages.Share.aiInstructions })

afterEach(cleanup)

describe('PostSession', () => {
  it('shows the session with the Study with AI buttons and their steps', () => {
    mount(true)
    expect(screen.getByText('Probe session')).toBeTruthy()
    expect(screen.getByText(messages.Share.aiSession)).toBeTruthy()
    expect(buttons()).toBeTruthy()
    expect(instructions()).toBeTruthy()
  })

  it('shows the session with no AI block when a switch is off', () => {
    mount(false)
    expect(screen.getByText('Probe session')).toBeTruthy()
    expect(screen.queryByText(messages.Share.aiSession)).toBeNull()
    expect(buttons()).toBeNull()
    expect(instructions()).toBeNull()
  })
})
