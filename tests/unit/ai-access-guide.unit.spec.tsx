import { cleanup, fireEvent, render as renderView, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The admin frame is Payload's; these tests read what the guide itself says.
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@payloadcms/ui', () => ({
  Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { AiAccessGuideView } from '@/components/admin/ai-access-guide'
import { ASSISTANTS } from '@/plugins/mcp/assistants'

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})

afterEach(() => vi.unstubAllGlobals())

const render = async (roles: string[], assistantName?: string) => {
  cleanup()
  const view = await AiAccessGuideView({
    initPageResult: {
      req: { i18n: {}, payload: {} },
      locale: { code: 'en' },
      permissions: {},
      visibleEntities: {},
    },
    params: {},
    searchParams: {},
    user: { id: 1, roles },
  } as never)
  const { container } = renderView(view as React.ReactElement)
  if (assistantName) {
    fireEvent.mouseDown(screen.getByRole('tab', { name: assistantName }), {
      button: 0,
      ctrlKey: false,
    })
    await waitFor(() =>
      expect(screen.getByRole('tab', { name: assistantName })).toHaveAttribute(
        'aria-selected',
        'true',
      ),
    )
  }
  return container.innerHTML
}

const textOf = (html: string) =>
  html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;/g, "'")
    .replace(/\s+/g, ' ')

describe('the AI assistants guide', () => {
  it('tells an administrator what it does, and that a person publishes', async () => {
    const text = textOf(await render(['admin']))
    expect(text).toContain('Connect an AI assistant')
    expect(text).toContain('Course and article drafts need your review')
    expect(text).toContain('A new form is readable by anyone who has its address')
    expect(text).toMatch(/publishes it/)
  })

  it('shows the address once, with one copy button for it', async () => {
    const html = await render(['admin'])
    expect(html).toContain('http://localhost:3000/api/mcp')
    expect(screen.getAllByRole('button', { name: 'Copy address' })).toHaveLength(1)
  })

  it('shows both assistants, from the table, with their steps and their settings link', async () => {
    for (const assistant of ASSISTANTS) {
      const html = await render(['admin'], assistant.name)
      expect(html).toContain(`<h3>${assistant.name}</h3>`)
      expect(html).toContain(assistant.settingsUrl)
      expect(textOf(html)).toContain(textOf(assistant.plans).trim())
      expect(textOf(html)).toContain(textOf(assistant.after).trim())
      for (const step of assistant.steps) expect(textOf(html)).toContain(textOf(step).trim())
      expect(html).toContain('rel="noopener noreferrer"')
    }
  })

  it('says which plans are needed', async () => {
    const text = textOf(await render(['admin']))
    expect(text).toMatch(/Owner adds it once/)
    const chatgpt = textOf(await render(['admin'], 'ChatGPT'))
    expect(chatgpt).toMatch(/Business, Enterprise or Edu/)
    expect(chatgpt).toMatch(/Plus or Pro/)
  })

  it('has examples for a course, an article and a form linked to a course', async () => {
    const html = await render(['admin'])
    expect(html).toContain('A course')
    expect(html).toContain('An article')
    expect(html).toContain('A form linked to a course')
    for (const title of ['A course', 'An article', 'A form linked to a course']) {
      fireEvent.mouseDown(screen.getByRole('tab', { name: title }), { button: 0, ctrlKey: false })
      await waitFor(() =>
        expect(screen.getByRole('tab', { name: title })).toHaveAttribute('aria-selected', 'true'),
      )
      await waitFor(() =>
        expect(screen.getByRole('button', { name: `Copy example: ${title}` })).toBeVisible(),
      )
      await waitFor(() =>
        expect(screen.getAllByRole('button', { name: /^Copy example:/ })).toHaveLength(1),
      )
    }
  })

  it('links to the lists where a person reviews and to the connected assistants', async () => {
    const html = await render(['admin'])
    for (const href of [
      '/admin/collections/courses',
      '/admin/collections/articles',
      '/admin/collections/forms',
      '/admin/reviews',
      '/admin/collections/oauth-tokens',
      '/admin/collections/oauth-clients',
    ]) {
      expect(html).toContain(`href="${href}"`)
    }
  })

  it('has the four safety points and nothing about keys', async () => {
    const text = textOf(await render(['admin']))
    expect(text).toMatch(/Check every draft/)
    expect(text).toMatch(/no page links to it until a person publishes the course/)
    expect(text).toMatch(/instructions you got from strangers/)
    expect(text).toMatch(/lost, disconnect it/)
  })

  it('uses no word an administrator would not know', async () => {
    const text = textOf(await render(['admin']))
    expect(text).not.toMatch(
      /\b(API keys?|keys?|tokens?|terminal|Node\.js|npx|npm|JSON|config|bearer)\b/i,
    )
  })

  it('refuses a person who is not an administrator', async () => {
    const text = textOf(await render(['member']))
    expect(text).toContain('Only administrators can connect an AI assistant.')
    expect(text).not.toContain('Copy address')
  })
})
