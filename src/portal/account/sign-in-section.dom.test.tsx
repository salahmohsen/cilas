import { fireEvent, screen, waitFor } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
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
let wait = 0

mockNetwork(
  http.post('/api/users/forgot-password', async ({ request }) => {
    requests.push(await request.json())
    if (wait) await delay(wait)
    return HttpResponse.json({}, { status })
  }),
)

beforeEach(() => {
  requests.length = 0
  status = 200
  wait = 0
})

const mount = () =>
  renderWithIntl(
    <>
      <LiveRegion />
      <SignInSection email={EMAIL} />
    </>,
  )

const button = () => screen.getByRole('button', { name: text.changePassword })
const exposed = (words: string) =>
  screen
    .queryAllByRole('status')
    .concat(screen.queryAllByRole('alert'))
    .filter((node) => node.textContent?.includes(words))
const region = (view: ReturnType<typeof mount>) =>
  view.container.querySelector('[data-portal-live]')!

describe('SignInSection', () => {
  it('the email shows read-only', () => {
    mount()
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

  it.each([
    ['sent', 200, sentLine],
    ['failed', 500, text.resetFailed],
  ])('a %s result is exposed to a screen reader in one place', async (_name, code, words) => {
    status = code
    const view = mount()
    fireEvent.click(button())
    await screen.findByText(words, { selector: 'strong *, strong' })
    await waitFor(() => expect(region(view)).toHaveTextContent(words))
    const places = exposed(words)
    expect(places).toHaveLength(1)
    expect(places[0]).toBe(region(view))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('while sending the button says so, keeps its place and ignores a second press', async () => {
    wait = 60
    mount()
    fireEvent.click(button())
    const busy = await screen.findByRole('button', { name: text.sending })
    expect(busy).toHaveAttribute('aria-busy', 'true')
    expect(busy).not.toBeDisabled()
    fireEvent.click(busy)
    await screen.findByText(sentLine, { selector: 'strong *, strong' })
    expect(requests).toHaveLength(1)
    expect(button()).not.toHaveAttribute('aria-busy')
  })
})
