import { cleanup, createEvent, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockNetwork } from '../../../testing/msw-node.test-utils'
import { ReadLink } from './read-link'

type Patch = { id: string; keepalive: boolean; body: unknown }
const patches: Patch[] = []

mockNetwork(
  http.patch('/api/notifications/:id', async ({ params, request }) => {
    patches.push({
      id: String(params.id),
      keepalive: request.keepalive,
      body: await request.json(),
    })
    return HttpResponse.json({})
  }),
)

afterEach(() => {
  cleanup()
  patches.length = 0
})

const settle = () => new Promise((resolve) => setTimeout(resolve, 20))

const link = () => {
  render(
    <ReadLink href="/en/spaces/x" id={7}>
      Open
    </ReadLink>,
  )
  const anchor = screen.getByRole('link', { name: 'Open' })
  anchor.addEventListener('click', (event) => event.preventDefault())
  return anchor
}

describe('ReadLink', () => {
  it('a click marks the row read with keepalive and keeps the navigation', async () => {
    const anchor = link()
    const click = createEvent.click(anchor)
    const preventDefault = vi.spyOn(click, 'preventDefault')
    fireEvent(anchor, click)
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).toMatchObject({ id: '7', keepalive: true })
    expect(preventDefault).toHaveBeenCalledOnce()
    expect(anchor).toHaveAttribute('href', '/en/spaces/x')
  })

  it('a middle click (auxclick, button 1) marks the row read', async () => {
    fireEvent(link(), new MouseEvent('auxclick', { bubbles: true, button: 1 }))
    await settle()
    expect(patches).toHaveLength(1)
  })

  it('a right click (auxclick, button 2, and contextmenu) does not mark the row read', async () => {
    const anchor = link()
    fireEvent(anchor, new MouseEvent('auxclick', { bubbles: true, button: 2 }))
    fireEvent.contextMenu(anchor)
    await settle()
    expect(patches).toHaveLength(0)
  })
})
