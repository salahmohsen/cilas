import { describe, expect, it } from 'vitest'

import { ASSISTANTS, assistantForCallback, assistantForCallbacks } from '@/plugins/mcp/assistants'
import { mcpServerUrl } from '@/plugins/mcp/paths'

describe('the assistants an admin may connect', () => {
  it('lists Claude and ChatGPT only', () => {
    expect(ASSISTANTS.map((assistant) => assistant.name)).toEqual(['Claude', 'ChatGPT'])
  })

  it('owns the callbacks the vendors document', () => {
    expect(assistantForCallback('https://claude.ai/api/mcp/auth_callback')?.name).toBe('Claude')
    expect(
      assistantForCallback('https://chatgpt.com/connector_platform_oauth_redirect')?.name,
    ).toBe('ChatGPT')
    expect(assistantForCallback('https://chatgpt.com/connector/oauth/abc_123-XYZ')?.name).toBe(
      'ChatGPT',
    )
  })

  it.each([
    'https://evil.example/cb',
    'http://claude.ai/api/mcp/auth_callback',
    'https://claude.ai.evil.example/api/mcp/auth_callback',
    'https://claude.ai/api/mcp/auth_callback/',
    'https://claude.ai/api/mcp/auth_callback?next=https://evil.example',
    'https://claude.com/api/mcp/auth_callback',
    'https://chatgpt.com/connector/oauth/',
    'https://chatgpt.com/connector/oauth/a/b',
    'https://chatgpt.com/connector/oauth/a?x=1',
    'https://chatgpt.com.evil.example/connector_platform_oauth_redirect',
    'http://localhost:3118/callback',
    '',
  ])('refuses %s', (uri) => {
    expect(assistantForCallback(uri)).toBeUndefined()
  })

  it('refuses mixed, empty and malformed registration callback sets', () => {
    const claude = 'https://claude.ai/api/mcp/auth_callback'
    const chatgpt = 'https://chatgpt.com/connector_platform_oauth_redirect'
    for (const callbacks of [
      [],
      null,
      [claude, chatgpt],
      [claude, 'https://evil.example'],
      [claude, 42],
    ]) {
      expect(assistantForCallbacks(callbacks)).toBeUndefined()
    }
    expect(assistantForCallbacks([chatgpt, 'https://chatgpt.com/connector/oauth/abc'])?.name).toBe(
      'ChatGPT',
    )
  })

  it('has no word an admin would not know', () => {
    const text = JSON.stringify(ASSISTANTS.map(({ steps, plans, after }) => [steps, plans, after]))
    expect(text).not.toMatch(/\b(API key|token|terminal|Node\.js|npm|JSON|config file)\b/i)
  })

  it('gives the address an admin pastes', () => {
    expect(mcpServerUrl('https://ci-las.org/')).toBe('https://ci-las.org/api/mcp')
    expect(mcpServerUrl('http://localhost:3000')).toBe('http://localhost:3000/api/mcp')
  })
})
