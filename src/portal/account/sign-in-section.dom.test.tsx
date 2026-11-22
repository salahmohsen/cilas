import { fireEvent, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { beforeEach, describe, expect, it } from 'vitest'

import { LiveRegion } from '@/portal/feedback/announce'

import { messagesOf, renderWithIntl } from '../../../testing/intl.test-utils'
import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { SignInSection } from './sign-in-section'

const text = messagesOf.en.Portal.account
const EMAIL = 'reader@example.org'
const sentLine = text.resetSent.replace('{email}', EMAIL)

const requests: unknown[] = []
let status = 200

mockNetwork(
  http.post('/api/users/forgot-password', async ({ request }) => {
    requests.push(await request.json())
    return HttpResponse.json({}, { status })
  }),
)

beforeEach(() => {
  requests.length = 0
  status = 200
})

const mount = () =>
  renderWithIntl(
    <>
      <LiveRegion />
      <SignInSection email={EMAIL} />
    </>,
  )

const button = () => screen.getByRole('button', { name: text.changePassword })
const region = (view: ReturnType<typeof mount>) =>
  view.container.querySelector('[data-portal-live]')!

describe('SignInSection', () => {
  it('the email shows read-only', () => {
    mount()
    expect(screen.getByText(text.signInIntro)).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(screen.getByText(text.email)).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('Change password sends the reset email and says where', async () => {
    mount()
    fireEvent.click(button())
    expect(await screen.findByText(sentLine, { selector: 'strong *, strong' })).toBeInTheDocument()
    expect(requests).toEqual([{ email: EMAIL }])
  })

  it('a failed send says so and keeps the button', async () => {
    status = 500
    mount()
    fireEvent.click(button())
    expect(
      await screen.findByText(text.resetFailed, { selector: 'strong *, strong' }),
    ).toBeVisible()
    expect(button()).not.toBeDisabled()
    expect(button()).not.toHaveAttribute('aria-disabled', 'true')
  })

  it('the result goes to the live region once', async () => {
    const view = mount()
    const seen: string[] = []
    const observer = new MutationObserver(() => seen.push(region(view).textContent ?? ''))
    observer.observe(region(view), { childList: true, characterData: true, subtree: true })
    fireEvent.click(button())
    await waitFor(() => expect(region(view)).toHaveTextContent(sentLine))
    observer.disconnect()
    expect(seen.filter((value) => value === sentLine)).toHaveLength(1)
  })
})
