import {
  OAuthInvalidTokenError,
  payloadMcpOAuth,
  type PayloadMcpOAuthConfig,
} from '@brainwebuk/payload-plugin-mcp-oauth'
import type { MCPAccessSettings, MCPPluginConfig } from '@payloadcms/plugin-mcp'
import type {
  CollectionAfterDeleteHook,
  CollectionAfterChangeHook,
  CollectionConfig,
  CollectionSlug,
  Config,
  Endpoint,
  Field,
  PayloadRequest,
  Plugin,
  Where,
} from 'payload'

import { isAdmin, isAdminUser } from '@/access'
import { env } from '@/env'

import { assistantForCallback, mcpServerUrl, type Assistant } from './assistants'
import { renderConsentPage, renderRefusalPage } from './consent-page'
import { AI_ACCESS_LINK } from './paths'
import { withAssistantLock } from './lock'

/** Names in the shape the plugin uses for its per-key switches. */
const camelCase = (name: string): string =>
  name
    .replace(/[-_\s]+(.)?/g, (_, chr: string | undefined) => (chr ? chr.toUpperCase() : ''))
    .replace(/^(.)/, (_, chr: string) => chr.toLowerCase())

const allOn = (names: ReadonlyArray<{ name: string }>): Record<string, boolean> =>
  Object.fromEntries(names.map(({ name }) => [camelCase(name), true]))

/**
 * The plugin's token check returns access for collections and globals only.
 * CILAS has none of those switched on, so an OAuth token would see no tool,
 * prompt or resource at all. This adds them for OAuth requests and leaves
 * API-key requests with the switches on their own key.
 *
 * Call it after `payloadMcpOAuth()` (which installs `overrideAuth`) and before
 * the plugins run (which copy the options), as `oauthMcp` does.
 */
export const grantOAuthCustomAccess = (options: MCPPluginConfig): void => {
  const previous = options.overrideAuth
  if (!previous) throw new Error('payloadMcpOAuth must run before grantOAuthCustomAccess')
  options.overrideAuth = async (req, getDefaultMcpAccessSettings) => {
    const settings: MCPAccessSettings = await previous(req, getDefaultMcpAccessSettings)
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!bearer?.startsWith('pmoauth_')) return settings
    // Someone who stopped being an admin loses the connection at once.
    if (!isAdminUser(settings.user)) throw new OAuthInvalidTokenError()
    return {
      ...settings,
      'payload-mcp-tool': allOn(options.mcp?.tools ?? []),
      'payload-mcp-prompt': allOn(options.mcp?.prompts ?? []),
      'payload-mcp-resource': allOn(options.mcp?.resources ?? []),
    }
  }
}

/* ============================================================== endpoints */

type Handler = Endpoint['handler']

const NO_STORE = { 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' }

const oauthError = (status: number, error: string, description: string): Response =>
  Response.json({ error, error_description: description }, { status, headers: NO_STORE })

/** The body of a form or JSON request, read once and left on `req.data` for the plugin. */
const readBody = async (req: PayloadRequest): Promise<Record<string, unknown>> => {
  if (req.data && typeof req.data === 'object') return req.data
  let body: Record<string, unknown> = {}
  const type = req.headers.get('content-type') ?? ''
  try {
    body = type.includes('application/x-www-form-urlencoded')
      ? Object.fromEntries(new URLSearchParams((await req.text?.()) ?? ''))
      : (((await req.json?.()) as Record<string, unknown> | undefined) ?? {})
  } catch {
    body = {}
  }
  req.data = body
  return body
}

const sameUrl = (a: string, b: string) => a.replace(/\/+$/, '') === b.replace(/\/+$/, '')

/** A person who may connect an assistant: a signed-in administrator account. */
export const mayConnect = (user: PayloadRequest['user']): boolean =>
  Boolean(user && user.collection === 'users' && isAdminUser(user))

const NOT_ADMIN_TEXT =
  'Only a CILAS administrator can connect an assistant. You are signed in, but your account is not an administrator, so nothing was shared. Sign in with an administrator account, or ask one to do this.'

const redirectWithError = (
  redirectUri: string,
  error: string,
  description: string,
  state: unknown,
  issuer: string,
): Response => {
  const url = new URL(redirectUri)
  url.searchParams.set('error', error)
  url.searchParams.set('error_description', description)
  if (typeof state === 'string' && state) url.searchParams.set('state', state)
  url.searchParams.set('iss', issuer)
  return new Response(null, { status: 302, headers: { Location: url.toString() } })
}

type Guards = { issuer: string; mcpUrl: string }

/** Only Claude and ChatGPT may register, and the name shown is ours, not theirs. */
const guardRegister =
  (original: Handler): Handler =>
  async (req) => {
    const body = await readBody(req)
    const uris = body.redirect_uris
    const owners = Array.isArray(uris)
      ? uris.map((uri) => (typeof uri === 'string' ? assistantForCallback(uri) : undefined))
      : []
    const first = owners[0]
    if (!first || owners.some((owner) => owner?.id !== first.id)) {
      return oauthError(
        400,
        'invalid_redirect_uri',
        'This address is not allowed. Only Claude and ChatGPT can connect to CILAS.',
      )
    }
    req.data = { ...body, client_name: first.name }
    return original(req)
  }

const querystring = (req: PayloadRequest, key: string): string | undefined => {
  const value = req.query?.[key]
  return typeof value === 'string' ? value : undefined
}

/**
 * The sign-in page. The plugin checks the client, the callback and the PKCE
 * challenge, and makes the one-use form tokens; CILAS decides who may see it
 * and what it says. The plugin's own form is kept as it is, so its tokens stay
 * valid, and put in a page of ours.
 */
const guardAuthorize =
  ({ issuer, mcpUrl }: Guards, original: Handler): Handler =>
  async (req) => {
    const redirectUri = querystring(req, 'redirect_uri') ?? ''
    const assistant = assistantForCallback(redirectUri)
    if (!assistant) {
      return oauthError(
        400,
        'invalid_redirect_uri',
        'This address is not allowed. Only Claude and ChatGPT can connect to CILAS.',
      )
    }
    if (req.user) {
      if (!mayConnect(req.user)) {
        return renderRefusalPage({ assistant, reason: NOT_ADMIN_TEXT, status: 403 })
      }
    } else {
      // The plugin sends a signed-out visitor to sign in, then back here.
      return original(req)
    }
    const resource = querystring(req, 'resource')
    if (resource && !sameUrl(resource, mcpUrl)) {
      return redirectWithError(
        redirectUri,
        'invalid_target',
        'The resource is not this CILAS server.',
        querystring(req, 'state'),
        issuer,
      )
    }
    const response = await original(req)
    if (response.status !== 200 || !(response.headers.get('content-type') ?? '').includes('html')) {
      return response
    }
    const page = renderConsentPage({
      assistant,
      email: String(req.user?.email ?? ''),
      pluginHtml: await response.text(),
      redirectHost: new URL(redirectUri).hostname,
    })
    return page
  }

/** Allow only repeats the sign-in page's checks, so a posted form cannot skip them. */
const guardConsent =
  ({ mcpUrl }: Guards, original: Handler): Handler =>
  async (req) => {
    if (req.user && !mayConnect(req.user)) return oauthError(403, 'access_denied', NOT_ADMIN_TEXT)
    const body = await readBody(req)
    if (typeof body.redirect_uri === 'string' && !assistantForCallback(body.redirect_uri)) {
      return oauthError(400, 'invalid_redirect_uri', 'This address is not allowed.')
    }
    if (typeof body.resource === 'string' && body.resource && !sameUrl(body.resource, mcpUrl)) {
      return oauthError(400, 'invalid_target', 'The resource is not this CILAS server.')
    }
    const nonce = body.csrf_nonce
    return typeof nonce === 'string'
      ? withAssistantLock(
          req.payload,
          `consent:${nonce}`,
          () => oauthError(400, 'invalid_request', 'This approval is already being processed.'),
          () => original(req),
        )
      : original(req)
  }

const guardToken =
  ({ mcpUrl }: Guards, original: Handler): Handler =>
  async (req) => {
    const body = await readBody(req)
    if (typeof body.resource === 'string' && body.resource && !sameUrl(body.resource, mcpUrl)) {
      return oauthError(400, 'invalid_target', 'The resource is not this CILAS server.')
    }
    const clientId = body.client_id
    return typeof clientId === 'string'
      ? withAssistantLock(
          req.payload,
          `oauth-client:${clientId}`,
          () => {
            const response = oauthError(
              503,
              'temporarily_unavailable',
              'Another sign-in operation is in progress. Try again shortly.',
            )
            response.headers.set('Retry-After', '1')
            return response
          },
          () => original(req),
        )
      : original(req)
  }

/** Names this server as the resource, as the pasted address, which is what clients compare. */
const guardResourceMetadata =
  ({ mcpUrl }: Guards, original: Handler): Handler =>
  async (req) => {
    const response = await original(req)
    const metadata = (await response.json()) as Record<string, unknown>
    return new Response(JSON.stringify({ ...metadata, resource: mcpUrl }), {
      status: response.status,
      headers: response.headers,
    })
  }

/* =========================================================== collections */

/**
 * Both clean-ups write through the database adapter, inside the caller's
 * transaction. Payload's own bulk delete here runs the hooks again and the
 * outer delete (of an account) was rolled back.
 */
const deleteTokens = (req: PayloadRequest, where: Where) =>
  req.payload.db.deleteMany({ collection: 'oauth-tokens' as CollectionSlug, where, req })

/** When a refresh row goes, every token of that connection goes with it, at once. */
const disconnectWholeConnection: CollectionAfterDeleteHook = async ({ doc, req }) => {
  if (doc.tokenType !== 'refresh') return
  await withAssistantLock(
    req.payload,
    `oauth-client:${doc.clientId}`,
    () => {
      throw new Error('The assistant is renewing its sign-in. Please try disconnecting it again.')
    },
    () =>
      deleteTokens(req, {
        and: [{ clientId: { equals: doc.clientId } }, { userId: { equals: doc.userId } }],
      }),
  )
}

/** Retention cleanup bypasses the manual-disconnect hook, even for rotated rows. */
const sweepTokenHistory: CollectionAfterChangeHook = async ({ doc, operation, req }) => {
  if (operation === 'create') {
    await deleteTokens(req, {
      expiresAt: { less_than: new Date(Date.now() - 30 * 86400000).toISOString() },
    })
  }
  return doc
}

const tokenChangeHooks = (collection: CollectionConfig): CollectionAfterChangeHook[] => {
  const hooks = collection.hooks?.afterChange ?? []
  // Version 0.5.1 installs [cascadeRevokeAccessTokens, sweepExpiredTokens].
  // Function names are minified in production, so identify the pinned layout.
  if (hooks.length !== 2) {
    throw new Error('OAuth token cleanup hook changed; review the pinned OAuth plugin integration.')
  }
  return [hooks[0]!, sweepTokenHistory]
}

/** A deleted account leaves no working token, code or form token behind. */
const deleteOwnersOAuth: CollectionAfterDeleteHook = async ({ id, req }) => {
  const where: Where = { userId: { equals: String(id) } }
  await deleteTokens(req, where)
  for (const collection of ['oauth-auth-codes', 'oauth-csrf-nonces'] as CollectionSlug[]) {
    await req.payload.db.deleteMany({ collection, where, req })
  }
}

/** Removing an assistant app removes the sign-ins made through it. */
const deleteClientsTokens: CollectionAfterDeleteHook = async ({ doc, req }) => {
  const where: Where = { clientId: { equals: String(doc.clientId) } }
  await withAssistantLock(
    req.payload,
    `oauth-client:${doc.clientId}`,
    () => {
      throw new Error('The assistant is renewing its sign-in. Please try deleting the app again.')
    },
    async () => {
      await deleteTokens(req, where)
      await req.payload.db.deleteMany({
        collection: 'oauth-auth-codes' as CollectionSlug,
        where,
        req,
      })
    },
  )
}

const hide = (fields: Field[], names: string[]): Field[] =>
  fields.map((field) =>
    'name' in field && names.includes(field.name)
      ? ({ ...field, admin: { ...field.admin, hidden: true } } as Field)
      : field,
  )

const lockFields = (fields: Field[], names: string[]): Field[] =>
  fields.map((field) =>
    'name' in field && names.includes(field.name)
      ? ({
          ...field,
          access: { ...('access' in field ? field.access : {}), update: () => false },
          admin: { ...field.admin, readOnly: true },
        } as Field)
      : field,
  )

const asAssistantApps = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  labels: { singular: 'Assistant app', plural: 'Assistant apps' },
  admin: {
    ...collection.admin,
    group: 'Site',
    // roleNav runs before the OAuth plugins (plugin order), so it cannot hide these.
    hidden: ({ user }) => !isAdminUser(user),
    description:
      'Each row is a separate registration of Claude or ChatGPT. Switching it off stops connections using that row. Other registrations keep working, and new registrations are still allowed.',
    components: { ...collection.admin?.components, beforeList: [AI_ACCESS_LINK] },
  },
  // Only on/off is the admin's to change: a changed address would send the
  // sign-in code to someone else.
  fields: lockFields(collection.fields, ['clientId', 'clientName', 'redirectUris']).map((field) =>
    'name' in field && field.name === 'isActive'
      ? ({ ...field, label: 'Allowed to connect' } as Field)
      : field,
  ),
  hooks: {
    ...collection.hooks,
    afterDelete: [...(collection.hooks?.afterDelete ?? []), deleteClientsTokens],
    beforeValidate: [
      ...(collection.hooks?.beforeValidate ?? []),
      // Whatever created the row, its callbacks are ours and its name is ours.
      ({ data, operation }) => {
        if (operation !== 'create' || !data) return data
        const uris = ((data.redirectUris ?? []) as Array<{ uri?: string }>).map((r) => r.uri ?? '')
        const owners = uris.map((uri) => assistantForCallback(uri))
        const first: Assistant | undefined = owners[0]
        if (!first || owners.some((owner) => owner?.id !== first.id)) {
          throw new Error('Only Claude and ChatGPT can be registered.')
        }
        return { ...data, clientName: first.name }
      },
    ],
  },
})

const asConnectedAssistants = (collection: CollectionConfig): CollectionConfig => ({
  ...collection,
  labels: { singular: 'Connected assistant', plural: 'Connected assistants' },
  admin: {
    ...collection.admin,
    group: 'Site',
    hidden: ({ user }) => !isAdminUser(user),
    defaultColumns: ['person', 'assistant', 'expiresAt'],
    description:
      'Each row is one person signed in to one assistant. To disconnect, delete the row: the assistant stops working at once, and the person can connect again.',
    // One row per connection: the long-lived sign-in, not its short access tokens.
    baseListFilter: (): Where => ({
      and: [
        { tokenType: { equals: 'refresh' } },
        { revokedAt: { equals: null } },
        { expiresAt: { greater_than: new Date().toISOString() } },
      ],
    }),
    components: { ...collection.admin?.components, beforeList: [AI_ACCESS_LINK] },
  },
  fields: [
    {
      name: 'person',
      type: 'text',
      virtual: true,
      label: 'Person',
      admin: { readOnly: true, description: 'The CILAS account the assistant acts as.' },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const id = siblingData?.userId
            if (!id) return undefined
            const user = await req.payload
              .findByID({
                collection: 'users',
                id: String(id),
                depth: 0,
                select: { email: true },
                overrideAccess: true,
                req,
              })
              .catch(() => null)
            return user?.email ?? 'Deleted account'
          },
        ],
      },
    },
    {
      name: 'assistant',
      type: 'text',
      virtual: true,
      label: 'Assistant',
      admin: { readOnly: true },
      hooks: {
        afterRead: [
          async ({ siblingData, req }) => {
            const { docs } = await req.payload.find({
              collection: 'oauth-clients' as CollectionSlug,
              where: { clientId: { equals: String(siblingData?.clientId ?? '') } },
              limit: 1,
              depth: 0,
              overrideAccess: true,
              req,
            })
            return (docs[0] as { clientName?: string } | undefined)?.clientName ?? 'Unknown'
          },
        ],
      },
    },
    ...hide(collection.fields, [
      'clientId',
      'userId',
      'tokenType',
      'scope',
      'capabilities',
      'parentTokenId',
    ]).map((field) =>
      'name' in field && field.name === 'expiresAt'
        ? ({ ...field, label: 'Sign-in ends' } as Field)
        : field,
    ),
  ],
  hooks: {
    ...collection.hooks,
    afterChange: tokenChangeHooks(collection),
    afterDelete: [...(collection.hooks?.afterDelete ?? []), disconnectWholeConnection],
  },
})

/**
 * CILAS's changes to the OAuth plugin, applied after it: who may register and
 * connect, the names and place of its collections in the admin, and the
 * clean-up when an account is deleted. Last of the OAuth plugins in `plugins`.
 */
export const hardenMcpOAuth = (siteUrl: string): Plugin => {
  const guards: Guards = { issuer: siteUrl.replace(/\/+$/, ''), mcpUrl: mcpServerUrl(siteUrl) }
  const harden = (config: Config): Config => {
    const byPath = (path: string, method: string) => (endpoint: Endpoint) =>
      endpoint.path.replace(/^\/api/, '') === path && endpoint.method === method
    const wrap =
      (path: string, method: string, guard: (original: Handler) => Handler) =>
      (endpoint: Endpoint): Endpoint =>
        byPath(path, method)(endpoint)
          ? { ...endpoint, handler: guard(endpoint.handler) }
          : endpoint

    const wrappers = [
      wrap('/oauth/register', 'post', guardRegister),
      wrap('/oauth/authorize', 'get', (h) => guardAuthorize(guards, h)),
      wrap('/oauth/consent', 'post', (h) => guardConsent(guards, h)),
      wrap('/oauth/token', 'post', (h) => guardToken(guards, h)),
      wrap('/.well-known/oauth-protected-resource', 'get', (h) => guardResourceMetadata(guards, h)),
    ]
    return {
      ...config,
      endpoints: (config.endpoints ?? []).map((endpoint) =>
        wrappers.reduce((current, apply) => apply(current), endpoint),
      ),
      collections: (config.collections ?? []).map((collection) => {
        if (collection.slug === 'oauth-clients') return asAssistantApps(collection)
        if (collection.slug === 'oauth-tokens') return asConnectedAssistants(collection)
        if (collection.slug === 'users') {
          return {
            ...collection,
            hooks: {
              ...collection.hooks,
              afterDelete: [...(collection.hooks?.afterDelete ?? []), deleteOwnersOAuth],
            },
          }
        }
        return collection
      }),
    }
  }
  // After the OAuth plugin (order 20), which Payload runs by `order`.
  return Object.assign(harden, { order: 30 })
}

/**
 * The plugin refuses to load without a 32-character pepper unless NODE_ENV is
 * development or test. `next build`, `payload migrate` and `generate:types`
 * also load the config, and none of them ever makes a token (the Docker build
 * stage even runs the migrations). They get a placeholder. The running server
 * (NODE_ENV=production, not building) never does: it needs the real secret,
 * and src/env.ts refuses to start without it.
 */
const PLACEHOLDER_PEPPER = 'placeholder-for-tools-that-make-no-tokens-0000000000'
export const allowToolsWithoutPepper = (): void => {
  if (process.env.PMOAUTH_TOKEN_PEPPER) return
  const serving =
    process.env.NODE_ENV === 'production' && process.env.NEXT_PHASE !== 'phase-production-build'
  if (!serving) process.env.PMOAUTH_TOKEN_PEPPER = PLACEHOLDER_PEPPER
}

/**
 * Registers OAuth for the MCP options, both plugins sharing the one object.
 * Returns the plugins in the order they must run.
 */
export const oauthMcp = (mcpOptions: MCPPluginConfig, siteUrl: string): Plugin[] => {
  allowToolsWithoutPepper()
  const options: PayloadMcpOAuthConfig = {
    issuer: siteUrl,
    mcpPluginOptions: mcpOptions,
    // `isAdmin` also lets a super admin in, which the plugin's own check does not.
    adminAccess: isAdmin,
    accessTokenTtlSeconds: 60 * 60,
    refreshTokenTtlSeconds: 30 * 24 * 60 * 60,
  }
  const oauth = payloadMcpOAuth(options)
  grantOAuthCustomAccess(mcpOptions)
  return [oauth, hardenMcpOAuth(siteUrl)]
}

export const siteUrl = (): string => env.NEXT_PUBLIC_SERVER_URL.replace(/\/+$/, '')
