// @vitest-environment node
import { createHash, randomBytes } from 'node:crypto'

import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import config from '@/payload.config'
import type { User } from '@/payload-types'
import { mcpServerUrl } from '@/plugins/mcp/assistants'

import { createTracker, uniqEmail } from './fixtures'

const SITE = 'http://localhost:3000'
const MCP = mcpServerUrl(SITE)
const CLAUDE = 'https://claude.ai/api/mcp/auth_callback'
const CHATGPT = 'https://chatgpt.com/connector_platform_oauth_redirect'

let payload: Payload
const { track, cleanup } = createTracker()
const clients: string[] = []

/** Calls one of the plugin's endpoints the way Payload's router does. */
const call = async (
  path: string,
  method: 'get' | 'post',
  {
    user,
    query = {},
    data,
    authorization,
  }: {
    user?: User | null
    query?: Record<string, string>
    data?: Record<string, unknown>
    authorization?: string
  } = {},
): Promise<Response> => {
  const endpoint = payload.config.endpoints.find((e) => e.path === path && e.method === method)
  if (!endpoint) throw new Error(`No endpoint ${method} ${path}`)
  const req = await createLocalReq(
    { user: user ? ({ ...user, collection: 'users' } as never) : undefined },
    payload,
  )
  const url = new URL(`${SITE}/api${path}`)
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  Object.assign(req, {
    url: url.toString(),
    method: method.toUpperCase(),
    query,
    data,
    headers: new Headers({
      'content-type': 'application/json',
      // A fresh address each call, so the plugin's per-address speed limits
      // (which these tests are not about) never refuse a test.
      'x-forwarded-for': `10.${randomBytes(1)[0]}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`,
      ...(authorization ? { authorization } : {}),
    }),
  })
  return endpoint.handler(req as PayloadRequest)
}

const mcp = async (token: string, method: string, params: Record<string, unknown> = {}) => {
  const endpoint = payload.config.endpoints.find((e) => e.path === '/mcp' && e.method === 'post')!
  const req = await createLocalReq({}, payload)
  Object.assign(req, {
    url: `${SITE}/api/mcp`,
    method: 'POST',
    headers: new Headers({
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      authorization: `Bearer ${token}`,
    }),
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  const res = await endpoint.handler(req as PayloadRequest)
  const body = await res.text()
  const line = body.split('\n').find((l) => l.startsWith('data:'))
  return {
    status: res.status,
    headers: res.headers,
    result: line ? (JSON.parse(line.slice(5)).result as Record<string, unknown>) : undefined,
  }
}

const names = (list: unknown, key: string): string[] =>
  ((list as Record<string, Array<{ name: string }>> | undefined)?.[key] ?? []).map((i) => i.name)

const register = async (callback: string, name = 'Whatever') => {
  const res = await call('/oauth/register', 'post', {
    data: { client_name: name, redirect_uris: [callback] },
  })
  const body = (await res.json()) as { client_id?: string; client_name?: string }
  if (body.client_id) clients.push(body.client_id)
  return { res, body }
}

const pkce = () => {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const authorize = async (
  user: User | null,
  clientId: string,
  callback: string,
  challenge: string,
  extra: Record<string, string> = {},
) =>
  call('/oauth/authorize', 'get', {
    user,
    query: {
      response_type: 'code',
      client_id: clientId,
      redirect_uri: callback,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state: 'xyz',
      resource: MCP,
      ...extra,
    },
  })

const hidden = (html: string): Record<string, string> =>
  Object.fromEntries(
    [...html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)].map((m) => [
      m[1]!,
      m[2]!.replace(/&amp;/g, '&'),
    ]),
  )

const codes = async () =>
  (await payload.count({ collection: 'oauth-auth-codes' as never, overrideAccess: true })).totalDocs

type Pair = { access_token: string; refresh_token: string; expires_in: number }

/** Register, authorize, allow and exchange: a connected assistant. */
const connect = async (user: User, callback = CLAUDE) => {
  const { body } = await register(callback)
  const { verifier, challenge } = pkce()
  const page = await authorize(user, body.client_id!, callback, challenge)
  const html = await page.text()
  const allowed = await call('/oauth/consent', 'post', {
    user,
    data: { ...hidden(html), decision: 'approve' },
  })
  const code = new URL(allowed.headers.get('location')!).searchParams.get('code')!
  const token = await call('/oauth/token', 'post', {
    data: {
      grant_type: 'authorization_code',
      code,
      client_id: body.client_id,
      redirect_uri: callback,
      code_verifier: verifier,
      resource: MCP,
    },
  })
  return { clientId: body.client_id!, pair: (await token.json()) as Pair, page, html, allowed }
}

const account = async (label: string, roles: User['roles']) =>
  track(
    'users',
    (await payload.create({
      collection: 'users',
      data: { email: uniqEmail(`oauth-${label}`), password: crypto.randomUUID(), roles },
      overrideAccess: true,
    })) as unknown as User,
  )

describe('assistants connect with OAuth', () => {
  let admin: User
  let superAdmin: User
  let member: User

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    admin = await account('admin', ['admin'])
    superAdmin = await account('super', ['super_admin'])
    member = await account('member', ['member'])
  })

  afterAll(async () => {
    for (const clientId of clients) {
      await payload
        .delete({
          collection: 'oauth-clients' as never,
          where: { clientId: { equals: clientId } },
          overrideAccess: true,
        })
        .catch(() => undefined)
    }
    await cleanup(payload)
    await payload.destroy()
  })

  describe('discovery', () => {
    it('names the MCP address as the protected resource', async () => {
      const res = await call('/.well-known/oauth-protected-resource', 'get')
      const body = (await res.json()) as Record<string, unknown>
      expect(body.resource).toBe(MCP)
      expect(body.authorization_servers).toEqual([SITE])
    })

    it('offers S256 only and returns the issuer on the callback', async () => {
      const res = await call('/.well-known/oauth-authorization-server', 'get')
      const body = (await res.json()) as Record<string, unknown>
      expect(body.code_challenge_methods_supported).toEqual(['S256'])
      expect(body.authorization_response_iss_parameter_supported).toBe(true)
      expect(body.issuer).toBe(SITE)
    })

    it('answers an unsigned MCP call with 401 and the resource metadata address', async () => {
      const { status, headers } = await mcp('', 'tools/list')
      expect(status).toBe(401)
      expect(headers.get('www-authenticate')).toContain(
        `resource_metadata="${SITE}/.well-known/oauth-protected-resource"`,
      )
    })
  })

  describe('registration', () => {
    it('lets Claude and ChatGPT register, under our names, not the ones they send', async () => {
      const claude = await register(CLAUDE, 'Trust Me Bank')
      expect(claude.res.status).toBe(201)
      expect(claude.body.client_name).toBe('Claude')
      const chatgpt = await register(CHATGPT, 'Another Name')
      expect(chatgpt.res.status).toBe(201)
      expect(chatgpt.body.client_name).toBe('ChatGPT')
      const stored = await payload.find({
        collection: 'oauth-clients' as never,
        where: { clientId: { equals: claude.body.client_id } },
        overrideAccess: true,
      })
      expect((stored.docs[0] as { clientName: string }).clientName).toBe('Claude')
    })

    it('accepts the ChatGPT callback that carries a connection id', async () => {
      const { res } = await register('https://chatgpt.com/connector/oauth/abc_123-XYZ')
      expect(res.status).toBe(201)
    })

    it.each([
      'https://evil.example/cb',
      'http://claude.ai/api/mcp/auth_callback',
      'https://claude.ai.evil.example/api/mcp/auth_callback',
      'https://chatgpt.com/connector/oauth/a/b',
      'http://localhost:3118/callback',
    ])('refuses %s', async (callback) => {
      const { res, body } = await register(callback)
      expect(res.status).toBe(400)
      expect(body).not.toHaveProperty('client_id')
    })

    it('refuses a registration that mixes callbacks', async () => {
      const res = await call('/oauth/register', 'post', {
        data: { client_name: 'x', redirect_uris: [CLAUDE, 'https://evil.example/cb'] },
      })
      expect(res.status).toBe(400)
    })

    it('refuses a client row with another callback, whatever made it', async () => {
      await expect(
        payload.create({
          collection: 'oauth-clients' as never,
          data: {
            clientId: crypto.randomUUID(),
            clientName: 'Evil',
            redirectUris: [{ uri: 'https://evil.example/cb' }],
          } as never,
          overrideAccess: true,
        }),
      ).rejects.toThrow()
    })
  })

  describe('the consent page', () => {
    it('lets an admin allow, in plain words that name the assistant and the account', async () => {
      const { body } = await register(CLAUDE, 'Sent Name')
      const res = await authorize(admin, body.client_id!, CLAUDE, pkce().challenge)
      const html = await res.text()
      expect(res.status).toBe(200)
      expect(html).toContain('Let Claude work on CILAS?')
      expect(html).toContain(admin.email)
      expect(html).toContain('make a draft of a course or an article')
      expect(html).toContain('A person has to read each draft and publish it.')
      expect(html).toContain('>Allow<')
      expect(html).not.toContain('Sent Name')
      const words = html
        .replace(admin.email, '')
        .replace(/<(style|title)>[\s\S]*?<\/\1>/g, '')
        .replace(/<[^>]+>/g, ' ')
      expect(words.match(/.{0,30}\b(token|OAuth|scope|API key)\b.{0,30}/i)?.[0]).toBeUndefined()
    })

    it('lets a super admin allow too', async () => {
      const { body } = await register(CHATGPT)
      const res = await authorize(superAdmin, body.client_id!, CHATGPT, pkce().challenge)
      expect(res.status).toBe(200)
      expect(await res.text()).toContain('Let ChatGPT work on CILAS?')
    })

    it('shows a member a refusal and issues no code', async () => {
      const { body } = await register(CLAUDE)
      const before = await codes()
      const res = await authorize(member, body.client_id!, CLAUDE, pkce().challenge)
      const html = await res.text()
      expect(res.status).toBe(403)
      expect(html).toContain('Claude cannot be connected')
      expect(html).toContain('not an administrator')
      expect(html).not.toContain('value="approve"')
      expect(await codes()).toBe(before)
    })

    it('refuses a member who posts the form anyway', async () => {
      const real = await register(CLAUDE)
      const { challenge } = pkce()
      const page = await authorize(admin, real.body.client_id!, CLAUDE, challenge)
      const fields = hidden(await page.text())
      const before = await codes()
      const res = await call('/oauth/consent', 'post', {
        user: member,
        data: { ...fields, decision: 'approve' },
      })
      expect(res.status).toBe(403)
      expect(res.headers.get('location')).toBeNull()
      expect(await codes()).toBe(before)
    })

    it('sends a signed-out visitor to sign in', async () => {
      const { body } = await register(CLAUDE)
      const res = await authorize(null, body.client_id!, CLAUDE, pkce().challenge)
      expect(res.status).toBe(302)
      expect(res.headers.get('location')).toContain('/admin/login?redirect=')
    })

    it('refuses another callback before it shows anything', async () => {
      const { body } = await register(CLAUDE)
      const res = await authorize(admin, body.client_id!, 'https://evil.example/cb', 'x'.repeat(43))
      expect(res.status).toBe(400)
    })

    it('refuses PKCE plain', async () => {
      const { body } = await register(CLAUDE)
      const res = await authorize(admin, body.client_id!, CLAUDE, pkce().challenge, {
        code_challenge_method: 'plain',
      })
      expect(res.headers.get('location')).toContain('error=invalid_request')
    })
  })

  describe('the resource parameter', () => {
    it('is echoed on the callback and bound to the MCP address', async () => {
      const { allowed } = await connect(admin)
      const url = new URL(allowed.headers.get('location')!)
      expect(url.searchParams.get('resource')).toBe(MCP)
      expect(url.searchParams.get('iss')).toBe(SITE)
      expect(url.searchParams.get('state')).toBe('xyz')
    })

    it('refuses a resource that is not this server, at authorize, consent and token', async () => {
      const { body } = await register(CLAUDE)
      const { challenge } = pkce()
      const other = 'https://other.example/api/mcp'
      const res = await authorize(admin, body.client_id!, CLAUDE, challenge, { resource: other })
      expect(res.headers.get('location')).toContain('error=invalid_target')

      const page = await authorize(admin, body.client_id!, CLAUDE, challenge)
      const consent = await call('/oauth/consent', 'post', {
        user: admin,
        data: { ...hidden(await page.text()), resource: other, decision: 'approve' },
      })
      expect(consent.status).toBe(400)

      const token = await call('/oauth/token', 'post', {
        data: {
          grant_type: 'authorization_code',
          code: 'x',
          client_id: body.client_id,
          redirect_uri: CLAUDE,
          code_verifier: 'v'.repeat(50),
          resource: other,
        },
      })
      expect(token.status).toBe(400)
      expect(((await token.json()) as { error: string }).error).toBe('invalid_target')
    })

    it('gives a token that signs in nowhere but the MCP address', async () => {
      const { pair } = await connect(admin)
      const result = await payload.auth({
        headers: new Headers({ authorization: `Bearer ${pair.access_token}` }),
      })
      expect(result.user).toBeNull()
    })
  })

  describe('a connected assistant', () => {
    it('lasts one hour for access and thirty days for refresh', async () => {
      const { pair, clientId } = await connect(admin)
      expect(pair.expires_in).toBe(3600)
      const rows = await payload.find({
        collection: 'oauth-tokens' as never,
        where: { and: [{ clientId: { equals: clientId } }, { tokenType: { equals: 'refresh' } }] },
        overrideAccess: true,
      })
      const days =
        (new Date((rows.docs[0] as { expiresAt: string }).expiresAt).getTime() - Date.now()) /
        86_400_000
      expect(days).toBeGreaterThan(29.9)
      expect(days).toBeLessThan(30.1)
    })

    it('sees the four tools, three prompts and three guides, and can use a tool', async () => {
      const { pair } = await connect(admin)
      const tools = await mcp(pair.access_token, 'tools/list')
      expect(names(tools.result, 'tools').sort()).toEqual([
        'create_article_draft',
        'create_course_draft',
        'create_form_and_link',
        'lookup',
      ])
      const prompts = await mcp(pair.access_token, 'prompts/list')
      expect(names(prompts.result, 'prompts').sort()).toEqual([
        'new_article',
        'new_course',
        'new_form_for_course',
      ])
      const resources = await mcp(pair.access_token, 'resources/list')
      expect(
        ((resources.result as { resources: Array<{ uri: string }> }).resources ?? [])
          .map((r) => r.uri)
          .sort(),
      ).toEqual(['cilas://guides/article', 'cilas://guides/course', 'cilas://guides/form'])
      const looked = await mcp(pair.access_token, 'tools/call', {
        name: 'lookup',
        arguments: { kind: 'cycles', limit: 1 },
      })
      expect(looked.result?.isError).not.toBe(true)
    })

    it('keeps the switches of an API key for a key', async () => {
      const secret = crypto.randomUUID()
      await payload.create({
        collection: 'payload-mcp-api-keys',
        data: {
          user: admin.id,
          label: 'only lookup',
          enableAPIKey: true,
          apiKey: secret,
          'payload-mcp-tool': {
            lookup: true,
            createCourseDraft: false,
            createArticleDraft: false,
            createFormAndLink: false,
          },
          'payload-mcp-prompt': { newCourse: false },
        } as never,
        overrideAccess: true,
      })
      const tools = await mcp(secret, 'tools/list')
      expect(names(tools.result, 'tools')).toEqual(['lookup'])
      const prompts = await mcp(secret, 'prompts/list')
      expect(names(prompts.result, 'prompts')).not.toContain('new_course')
    })

    it('refreshes, and the old refresh token stops', async () => {
      const { pair, clientId } = await connect(admin)
      const body = {
        grant_type: 'refresh_token',
        refresh_token: pair.refresh_token,
        client_id: clientId,
      }
      const next = (await (await call('/oauth/token', 'post', { data: body })).json()) as Pair
      expect(next.access_token).toBeTruthy()
      expect((await mcp(next.access_token, 'tools/list')).status).toBe(200)
      const again = await call('/oauth/token', 'post', { data: body })
      expect(again.status).toBe(400)
    })

    it('stops at once when the access token is revoked', async () => {
      const { pair, clientId } = await connect(admin)
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(200)
      await call('/oauth/revoke', 'post', {
        data: { token: pair.access_token, client_id: clientId },
      })
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(401)
    })

    it('stops at once when an admin disconnects it in the panel', async () => {
      const { pair, clientId } = await connect(admin)
      const rows = await payload.find({
        collection: 'oauth-tokens' as never,
        where: { and: [{ clientId: { equals: clientId } }, { tokenType: { equals: 'refresh' } }] },
        overrideAccess: true,
      })
      await payload.delete({
        collection: 'oauth-tokens' as never,
        id: (rows.docs[0] as { id: number }).id,
        user: { ...admin, collection: 'users' } as never,
        overrideAccess: false,
      })
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(401)
      const left = await payload.count({
        collection: 'oauth-tokens' as never,
        where: { clientId: { equals: clientId } },
        overrideAccess: true,
      })
      expect(left.totalDocs).toBe(0)
    })

    it('stops at once when switching off the assistant app', async () => {
      const { pair, clientId } = await connect(admin)
      await payload.update({
        collection: 'oauth-clients' as never,
        where: { clientId: { equals: clientId } },
        data: { isActive: false } as never,
        overrideAccess: true,
      })
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(401)
    })

    it('stops at once when the account is no longer an admin', async () => {
      const temp = await account('demoted', ['admin'])
      const { pair } = await connect(temp)
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(200)
      await payload.update({
        collection: 'users',
        id: temp.id,
        data: { roles: ['member'] },
        overrideAccess: true,
      })
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(401)
    })

    it('does not fail to delete an account that has connections, and ends them', async () => {
      const temp = await account('deleted', ['admin'])
      const { pair } = await connect(temp)
      await payload.delete({ collection: 'users', id: temp.id, overrideAccess: true })
      const gone = await payload.count({
        collection: 'users',
        where: { id: { equals: temp.id } },
        overrideAccess: true,
      })
      expect(gone.totalDocs).toBe(0)
      expect((await mcp(pair.access_token, 'tools/list')).status).toBe(401)
      const left = await payload.count({
        collection: 'oauth-tokens' as never,
        where: { userId: { equals: String(temp.id) } },
        overrideAccess: true,
      })
      expect(left.totalDocs).toBe(0)
    })
  })

  describe('in the admin panel', () => {
    const collection = (slug: string) => payload.config.collections.find((c) => c.slug === slug)!

    it.each(['oauth-clients', 'oauth-tokens'])('puts %s under Site, for admins only', (slug) => {
      const { admin: panel } = collection(slug)
      expect(panel.group).toBe('Site')
      const isHidden = panel.hidden as (args: { user: unknown }) => boolean
      expect(isHidden({ user: { roles: ['admin'] } })).toBe(false)
      expect(isHidden({ user: { roles: ['super_admin'] } })).toBe(false)
      expect(isHidden({ user: { roles: ['member'] } })).toBe(true)
    })

    it('gives them names an admin knows', () => {
      expect(collection('oauth-tokens').labels?.plural).toBe('Connected assistants')
      expect(collection('oauth-clients').labels?.plural).toBe('Assistant apps')
    })

    it('lets a super admin and an admin read connections, and no one else', async () => {
      for (const user of [admin, superAdmin]) {
        await expect(
          payload.find({
            collection: 'oauth-tokens' as never,
            user: { ...user, collection: 'users' } as never,
            overrideAccess: false,
          }),
        ).resolves.toBeDefined()
      }
      await expect(
        payload.find({
          collection: 'oauth-tokens' as never,
          user: { ...member, collection: 'users' } as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })

    it('shows the person and the assistant of a connection', async () => {
      const { clientId } = await connect(admin)
      const rows = await payload.find({
        collection: 'oauth-tokens' as never,
        where: { and: [{ clientId: { equals: clientId } }, { tokenType: { equals: 'refresh' } }] },
        user: { ...admin, collection: 'users' } as never,
        overrideAccess: false,
      })
      const row = rows.docs[0] as unknown as { person: string; assistant: string }
      expect(row.person).toBe(admin.email)
      expect(row.assistant).toBe('Claude')
    })

    it('keeps the address of an assistant app out of an admin’s reach', async () => {
      const { clientId } = await connect(admin)
      await expect(
        payload.update({
          collection: 'oauth-clients' as never,
          where: { clientId: { equals: clientId } },
          data: { redirectUris: [{ uri: 'https://evil.example/cb' }] } as never,
          user: { ...admin, collection: 'users' } as never,
          overrideAccess: false,
        }),
      ).resolves.toBeDefined()
      const stored = await payload.find({
        collection: 'oauth-clients' as never,
        where: { clientId: { equals: clientId } },
        overrideAccess: true,
      })
      expect(
        (stored.docs[0] as { redirectUris: Array<{ uri: string }> }).redirectUris[0]!.uri,
      ).toBe(CLAUDE)
    })
  })
})
