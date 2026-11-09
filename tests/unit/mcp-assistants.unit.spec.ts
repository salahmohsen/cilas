import { describe, expect, it } from 'vitest'

import { ASSISTANTS, assistantForCallback, mcpServerUrl } from '@/plugins/mcp/assistants'

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

  it('has short numbered steps, a settings link and a plan note for each', () => {
    for (const assistant of ASSISTANTS) {
      expect(assistant.steps.length).toBeGreaterThanOrEqual(4)
      expect(assistant.steps.length).toBeLessThanOrEqual(8)
      expect(assistant.settingsUrl).toMatch(/^https:\/\//)
      expect(assistant.plans.length).toBeGreaterThan(20)
    }
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
