/**
 * The assistants an admin may connect. One table drives both the OAuth
 * allowlist (who may register and which name the consent page shows) and the
 * admin guide (the steps, the settings link, the plans). Plain data, so a
 * client component can import it.
 *
 * Callbacks come from each vendor's own documentation:
 * - Claude: https://claude.com/docs/connectors/building/authentication
 *   ("Callback URLs": the hosted apps use exactly this one address).
 * - ChatGPT: https://developers.openai.com/plugins/build/auth ("Redirect URL":
 *   a stable address when the server returns `iss`, which this one does, else
 *   one address per connection under /connector/oauth/).
 */
export type Assistant = {
  id: 'claude' | 'chatgpt'
  name: string
  callbacks: readonly string[]
  /** Redirect addresses that end in an id OpenAI chooses per connection. */
  callbackPatterns: readonly RegExp[]
  settingsUrl: string
  settingsLabel: string
  plans: string
  steps: readonly string[]
  after: string
}

export const ASSISTANTS: readonly Assistant[] = [
  {
    id: 'claude',
    name: 'Claude',
    callbacks: ['https://claude.ai/api/mcp/auth_callback'],
    callbackPatterns: [],
    settingsUrl: 'https://claude.ai/customize/connectors',
    settingsLabel: 'Open Claude connectors',
    plans:
      'Works on Claude Free (one custom connector), Pro, Max, Team and Enterprise. On Team and Enterprise an Owner adds it once for the organization, and then each member signs in with their own CILAS account.',
    steps: [
      'Open Customize, then Connectors. On a Team or Enterprise plan, an Owner opens Organization settings, then Connectors.',
      'Choose Add custom connector. On a Team or Enterprise plan, choose Add, then Custom.',
      'Paste the address you copied. Leave the advanced settings empty.',
      'Click Add, then Connect.',
      'Sign in to CILAS if asked. On the CILAS page, read what Claude can do and click Allow.',
    ],
    after: 'In a new chat, press + and turn the CILAS connector on. Then ask for what you need.',
  },
  {
    id: 'chatgpt',
    name: 'ChatGPT',
    callbacks: ['https://chatgpt.com/connector_platform_oauth_redirect'],
    callbackPatterns: [/^https:\/\/chatgpt\.com\/connector\/oauth\/[A-Za-z0-9_-]{1,128}$/],
    settingsUrl: 'https://chatgpt.com/plugins',
    settingsLabel: 'Open ChatGPT plugins',
    plans:
      'Needs a ChatGPT Business, Enterprise or Edu workspace. An owner or admin of that workspace adds it. A personal Plus or Pro plan may not let you create drafts through a custom connector, so check before you plan around it.',
    steps: [
      'Open ChatGPT Plugins on the web.',
      'Click the plus button, then Add custom MCP server.',
      'Type a name, for example CILAS admin.',
      'Paste the address you copied into Server URL.',
      'Set authentication to OAuth. Leave client ID and secret empty.',
      'Read the warning, tick that you understand, and click Create as a plugin.',
      'Sign in to CILAS if asked. On the CILAS page, read what ChatGPT can do and click Allow.',
    ],
    after:
      'Install the plugin. In a new chat, type @ and pick it. ChatGPT asks you to confirm each change before it makes it.',
  },
]

export const assistantForCallback = (redirectUri: string): Assistant | undefined =>
  ASSISTANTS.find(
    (assistant) =>
      assistant.callbacks.includes(redirectUri) ||
      assistant.callbackPatterns.some((pattern) => pattern.test(redirectUri)),
  )

export const assistantForCallbacks = (uris: unknown): Assistant | undefined => {
  if (!Array.isArray(uris) || !uris.length) return undefined
  const owners = uris.map((uri) =>
    typeof uri === 'string' ? assistantForCallback(uri) : undefined,
  )
  const first = owners[0]
  return first && owners.every((owner) => owner?.id === first.id) ? first : undefined
}
