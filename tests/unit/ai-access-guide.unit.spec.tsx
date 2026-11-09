import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// The admin frame is Payload's; these tests read what the guide itself says.
vi.mock('@payloadcms/next/templates', () => ({
  DefaultTemplate: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@payloadcms/ui', () => ({
  Gutter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { AiAccessGuideView } from '@/components/admin/ai-access-guide'
import { ASSISTANTS } from '@/plugins/mcp/assistants'

const render = async (roles: string[]) => {
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
  return renderToStaticMarkup(view as React.ReactElement)
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
    expect(text).toContain('Nothing goes live')
    expect(text).toMatch(/publishes it/)
  })

  it('shows the address once, with one copy button for it', async () => {
    const html = await render(['admin'])
    expect(html).toContain('http://localhost:3000/api/mcp')
    expect(html.match(/>Copy address</g)).toHaveLength(1)
  })

  it('shows both assistants, from the table, with their steps and their settings link', async () => {
    const html = await render(['admin'])
    for (const assistant of ASSISTANTS) {
      expect(html).toContain(`<h3>${assistant.name}</h3>`)
      expect(html).toContain(assistant.settingsUrl)
      for (const step of assistant.steps) expect(textOf(html)).toContain(textOf(step).trim())
    }
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('says which plans are needed', async () => {
    const text = textOf(await render(['admin']))
    expect(text).toMatch(/Owner adds it once/)
    expect(text).toMatch(/Business, Enterprise or Edu/)
    expect(text).toMatch(/Plus or Pro/)
  })

  it('has examples for a course, an article and a form linked to a course', async () => {
    const html = await render(['admin'])
    expect(html).toContain('A course')
    expect(html).toContain('An article')
    expect(html).toContain('A form linked to a course')
    expect(html.match(/>Copy example</g)).toHaveLength(3)
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
