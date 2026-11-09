/**
 * Drives the whole OAuth connection of an assistant against a running server,
 * the way Claude or ChatGPT does it, and checks the rules on the way.
 *
 *   DATABASE_URL=postgres://…@localhost:5433/<throwaway> pnpm dev          (or next start)
 *   DATABASE_URL=… BASE_URL=http://localhost:3000 pnpm tsx scripts/mcp-oauth-flow.ts
 *
 * It makes a few accounts in the database the server uses, and removes them
 * at the end. It refuses to run unless that database is on localhost.
 */
import { createHash, randomBytes } from 'node:crypto'

import { getPayload, type Payload } from 'payload'

const BASE = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const MCP = `${BASE}/api/mcp`
const CLAUDE_CALLBACK = 'https://claude.ai/api/mcp/auth_callback'
const CHATGPT_CALLBACK = 'https://chatgpt.com/connector_platform_oauth_redirect'

if (!/@(localhost|127\.0\.0\.1)[:/]/.test(process.env.DATABASE_URL ?? '')) {
  throw new Error('Refusing to run: DATABASE_URL must be a database on localhost.')
}

let failures = 0
const check = (name: string, ok: boolean, detail?: unknown) => {
  if (!ok) failures += 1
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}${ok || detail === undefined ? '' : `  -> ${String(detail).slice(0, 300)}`}`,
  )
}

const form = (data: Record<string, string>) => new URLSearchParams(data).toString()
const pkce = () => {
  const verifier = randomBytes(48).toString('base64url')
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') }
}

const mcp = (token: string | null, method: string, params: Record<string, unknown> = {}) =>
  fetch(MCP, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })

const login = async (email: string, password: string): Promise<string> => {
  const res = await fetch(`${BASE}/api/users/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const { token } = (await res.json()) as { token?: string }
  if (!token) throw new Error(`Could not sign in as ${email}: ${res.status}`)
  return `payload-token=${token}`
}

const register = (callback: string, name: string) =>
  fetch(`${BASE}/api/oauth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: name, redirect_uris: [callback] }),
  })

const authorizeUrl = (clientId: string, callback: string, challenge: string, extra = {}) => {
  const url = new URL(`${BASE}/api/oauth/authorize`)
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: clientId,
    redirect_uri: callback,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    state: 'xyz',
    resource: MCP,
    ...extra,
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

const hiddenFields = (html: string): Record<string, string> => {
  const fields: Record<string, string> = {}
  for (const match of html.matchAll(/<input type="hidden" name="([^"]+)" value="([^"]*)">/g)) {
    fields[match[1]!] = match[2]!.replace(/&amp;/g, '&').replace(/&quot;/g, '"')
  }
  return fields
}

const payload: Payload = await getPayload({
  config: (await import('../src/payload.config')).default,
})
const stamp = randomBytes(4).toString('hex')
const password = randomBytes(12).toString('hex')
const accounts: Array<string | number> = []
const makeUser = async (label: string, roles: Array<'admin' | 'member' | 'super_admin'>) => {
  const user = await payload.create({
    collection: 'users',
    data: { email: `oauth-flow-${label}-${stamp}@cilas.test`, password, roles },
    overrideAccess: true,
  })
  accounts.push(user.id)
  return user
}
const clientIds: string[] = []

/** The whole connection for one account: authorize, consent, code, token. */
const connect = async (
  cookie: string,
  registered: { client_id: string },
  callback = CLAUDE_CALLBACK,
) => {
  const { verifier, challenge } = pkce()
  const page = await fetch(authorizeUrl(registered.client_id, callback, challenge), {
    headers: { cookie },
    redirect: 'manual',
  })
  const html = await page.text()
  return { registered, verifier, challenge, page, html }
}

const approve = async (cookie: string, html: string) => {
  const res = await fetch(`${BASE}/api/oauth/consent`, {
    method: 'POST',
    headers: { cookie, origin: BASE, 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ ...hiddenFields(html), decision: 'approve' }),
    redirect: 'manual',
  })
  return {
    res,
    location: res.headers.get('location') ? new URL(res.headers.get('location')!) : null,
  }
}

const exchange = (clientId: string, code: string, verifier: string, callback: string, extra = {}) =>
  fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      redirect_uri: callback,
      code_verifier: verifier,
      resource: MCP,
      ...extra,
    }),
  })

/** An MCP reply comes as one server-sent event: `data: {json-rpc}`. */
const rpc = (
  body: string,
): {
  result?: { tools?: Array<{ name: string }>; isError?: boolean; content?: Array<{ text: string }> }
} | null => {
  const line = body.split('\n').find((l) => l.startsWith('data:'))
  return line ? JSON.parse(line.slice(5)) : null
}
const toolNames = (body: string) => rpc(body)?.result?.tools?.map((t) => t.name) ?? []
const result = (body: string) => rpc(body)?.result

type Pair = { access_token: string; refresh_token: string; expires_in: number }

try {
  const admin = await makeUser('admin', ['admin'])
  const superAdmin = await makeUser('super', ['super_admin'])
  const member = await makeUser('member', ['member'])
  const adminCookie = await login(admin.email, password)
  const memberCookie = await login(member.email, password)

  // 401 and discovery.
  const unauth = await mcp(null, 'tools/list')
  const challenge401 = unauth.headers.get('www-authenticate') ?? ''
  check('401 without a token', unauth.status === 401, unauth.status)
  check(
    '401 names the resource metadata',
    /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource"/.test(challenge401),
    challenge401,
  )
  const prm = (await (
    await fetch(`${BASE}/.well-known/oauth-protected-resource`)
  ).json()) as Record<string, unknown>
  check('protected resource is the MCP address', prm.resource === MCP, prm.resource)
  check(
    'protected resource is also served under the MCP path',
    (await fetch(`${BASE}/.well-known/oauth-protected-resource/api/mcp`)).status === 200,
  )
  const meta = (await (
    await fetch(`${BASE}/.well-known/oauth-authorization-server`)
  ).json()) as Record<string, unknown>
  check(
    'PKCE: S256 only',
    JSON.stringify(meta.code_challenge_methods_supported) === '["S256"]',
    meta.code_challenge_methods_supported,
  )
  check('issuer is the site', meta.issuer === BASE, meta.issuer)
  check(
    'issuer is returned on the callback (RFC 9207)',
    meta.authorization_response_iss_parameter_supported === true,
  )

  // Registration.
  check(
    'registration refused for another callback',
    (await register('https://evil.example/cb', 'Claude')).status === 400,
  )
  check(
    'registration refused for a plain-http callback',
    (await register('http://claude.ai/api/mcp/auth_callback', 'Claude')).status === 400,
  )
  const chatgpt = await register(CHATGPT_CALLBACK, 'Totally Not Evil')
  const chatgptClient = (await chatgpt.json()) as { client_id: string; client_name: string }
  clientIds.push(chatgptClient.client_id)
  check('ChatGPT may register', chatgpt.status === 201, chatgpt.status)
  check(
    'the name shown is ours, not the one sent',
    chatgptClient.client_name === 'ChatGPT',
    chatgptClient.client_name,
  )

  // Signed out: sent to sign in.
  const claude = await register(CLAUDE_CALLBACK, 'Anything')
  const claudeClient = (await claude.json()) as { client_id: string }
  clientIds.push(claudeClient.client_id)
  const { verifier: v0, challenge: c0 } = pkce()
  const signedOut = await fetch(authorizeUrl(claudeClient.client_id, CLAUDE_CALLBACK, c0), {
    redirect: 'manual',
  })
  check(
    'signed-out visitor is sent to sign in',
    signedOut.status === 302 &&
      (signedOut.headers.get('location') ?? '').includes('/admin/login?redirect='),
    signedOut.headers.get('location'),
  )
  void v0

  // Plain PKCE refused.
  const plain = await fetch(
    authorizeUrl(claudeClient.client_id, CLAUDE_CALLBACK, c0, { code_challenge_method: 'plain' }),
    { headers: { cookie: adminCookie }, redirect: 'manual' },
  )
  check(
    'PKCE plain refused',
    plain.status === 302 && (plain.headers.get('location') ?? '').includes('error=invalid_request'),
    plain.headers.get('location'),
  )

  // A wrong resource is refused.
  const wrongResource = await fetch(
    authorizeUrl(claudeClient.client_id, CLAUDE_CALLBACK, c0, {
      resource: 'https://other.example/api/mcp',
    }),
    { headers: { cookie: adminCookie }, redirect: 'manual' },
  )
  check(
    'a resource that is not this server is refused',
    (wrongResource.headers.get('location') ?? '').includes('error=invalid_target'),
    wrongResource.headers.get('location'),
  )

  // A member is refused at the consent page and cannot post the form.
  const before = await payload.count({
    collection: 'oauth-auth-codes' as never,
    overrideAccess: true,
  })
  const asMember = await connect(memberCookie, claudeClient)
  check(
    'a member sees a refusal',
    asMember.page.status === 403 &&
      /cannot be connected/.test(asMember.html) &&
      /not an administrator/.test(asMember.html),
    asMember.page.status,
  )
  check('the refusal shows no Allow button', !/value="approve"/.test(asMember.html))
  const forged = await fetch(`${BASE}/api/oauth/consent`, {
    method: 'POST',
    headers: {
      cookie: memberCookie,
      origin: BASE,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form({
      client_id: asMember.registered.client_id,
      redirect_uri: CLAUDE_CALLBACK,
      code_challenge: asMember.challenge,
      code_challenge_method: 'S256',
      csrf_token: 'x.y',
      csrf_nonce: 'z',
      decision: 'approve',
    }),
    redirect: 'manual',
  })
  check('a member cannot post the form either', forged.status === 403, forged.status)
  const after = await payload.count({
    collection: 'oauth-auth-codes' as never,
    overrideAccess: true,
  })
  check(
    'no code was issued to a member',
    after.totalDocs === before.totalDocs,
    `${before.totalDocs} -> ${after.totalDocs}`,
  )

  // An admin: consent page, Allow, code.
  const connection = await connect(adminCookie, claudeClient)
  check(
    'an admin sees the consent page',
    connection.page.status === 200 && /Let Claude work on CILAS\?/.test(connection.html),
    connection.page.status,
  )
  check(
    'the page names the account and says a person publishes',
    connection.html.includes(admin.email) &&
      /A person has to read each draft and publish it/.test(connection.html),
  )
  check(
    'the page has Allow and Do not allow',
    />Allow</.test(connection.html) && />Do not allow</.test(connection.html),
  )
  check('the page names Claude from our table', !connection.html.includes('Anything'))
  const allowed = await approve(adminCookie, connection.html)
  const code = allowed.location?.searchParams.get('code')
  check(
    'Allow redirects to the callback with a code',
    allowed.res.status === 302 &&
      `${allowed.location?.origin}${allowed.location?.pathname}` === CLAUDE_CALLBACK &&
      Boolean(code),
    allowed.res.headers.get('location'),
  )
  check(
    'the callback carries state, issuer and resource',
    allowed.location?.searchParams.get('state') === 'xyz' &&
      allowed.location?.searchParams.get('iss') === BASE &&
      allowed.location?.searchParams.get('resource') === MCP,
  )

  // Token.
  const wrongTarget = await exchange(
    connection.registered.client_id,
    code!,
    connection.verifier,
    CLAUDE_CALLBACK,
    { resource: 'https://other.example/api/mcp' },
  )
  check(
    'the token request with another resource is refused',
    wrongTarget.status === 400,
    wrongTarget.status,
  )
  const badVerifier = await exchange(
    connection.registered.client_id,
    code!,
    pkce().verifier,
    CLAUDE_CALLBACK,
  )
  check('a wrong PKCE verifier is refused', badVerifier.status === 400)
  const tokenRes = await exchange(
    connection.registered.client_id,
    code!,
    connection.verifier,
    CLAUDE_CALLBACK,
  )
  const pair = (await tokenRes.json()) as Pair
  check(
    'the code is exchanged for a token pair',
    tokenRes.status === 200 &&
      pair.access_token?.startsWith('pmoauth_at_') &&
      pair.expires_in === 3600,
    tokenRes.status,
  )
  check(
    'the code cannot be used twice',
    (await exchange(connection.registered.client_id, code!, connection.verifier, CLAUDE_CALLBACK))
      .status === 400,
  )
  const refreshRow = await payload.find({
    collection: 'oauth-tokens' as never,
    where: {
      and: [{ tokenType: { equals: 'refresh' } }, { userId: { equals: String(admin.id) } }],
    },
    overrideAccess: true,
    limit: 1,
  })
  const days =
    (new Date((refreshRow.docs[0] as { expiresAt: string }).expiresAt).getTime() - Date.now()) /
    86_400_000
  check('the refresh token lasts 30 days', days > 29.9 && days < 30.1, days)

  // The MCP endpoint.
  const list = await (await mcp(pair.access_token, 'tools/list')).text()
  const names = [
    'lookup',
    'create_course_draft',
    'create_article_draft',
    'create_form_and_link',
    'update_course_draft',
    'update_article_draft',
  ]
  check(
    'tools/list shows the four tools',
    names.every((name) => list.includes(`"${name}"`)),
    list.slice(0, 200),
  )
  const listed = toolNames(list)
  check('tools/list shows nothing else', listed.length === 4, listed.join(', '))
  const prompts = await (await mcp(pair.access_token, 'prompts/list')).text()
  check(
    'prompts/list shows the three prompts',
    ['new_course', 'new_article', 'new_form_for_course'].every((name) =>
      prompts.includes(`"${name}"`),
    ),
  )
  const resources = await (await mcp(pair.access_token, 'resources/list')).text()
  check(
    'resources/list shows the three guides',
    ['cilas://guides/course', 'cilas://guides/article', 'cilas://guides/form'].every((uri) =>
      resources.includes(uri),
    ),
  )
  const lookup = await (
    await mcp(pair.access_token, 'tools/call', {
      name: 'lookup',
      arguments: { kind: 'cycles', limit: 1 },
    })
  ).text()
  const looked = result(lookup)
  check(
    'tools/call lookup works',
    looked?.isError !== true && String(looked?.content?.[0]?.text).includes('"count"'),
    lookup.slice(0, 200),
  )

  // The token works at the MCP address only.
  const me = await fetch(`${BASE}/api/users/me`, {
    headers: { authorization: `Bearer ${pair.access_token}` },
  })
  check(
    'the token does not sign in anywhere else',
    ((await me.json()) as { user: unknown }).user === null,
  )

  // Refresh.
  const refreshed = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'refresh_token',
      refresh_token: pair.refresh_token,
      client_id: connection.registered.client_id,
    }),
  })
  const pair2 = (await refreshed.json()) as Pair
  check(
    'refresh gives a new pair',
    refreshed.status === 200 && pair2.access_token !== pair.access_token,
    refreshed.status,
  )
  check('the new access token works', (await mcp(pair2.access_token, 'tools/list')).status === 200)

  // Revoke stops it at once.
  await fetch(`${BASE}/api/oauth/revoke`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({ token: pair2.access_token, client_id: connection.registered.client_id }),
  })
  check(
    'a revoked token stops at once',
    (await mcp(pair2.access_token, 'tools/list')).status === 401,
  )

  // Disconnecting in the panel stops it at once.
  const again = await fetch(`${BASE}/api/oauth/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form({
      grant_type: 'refresh_token',
      refresh_token: pair2.refresh_token,
      client_id: connection.registered.client_id,
    }),
  })
  const pair3 = (await again.json()) as Pair
  check(
    'the refresh token still works after an access token is revoked',
    again.status === 200,
    again.status,
  )
  const live = await payload.find({
    collection: 'oauth-tokens' as never,
    where: {
      and: [
        { tokenType: { equals: 'refresh' } },
        { userId: { equals: String(admin.id) } },
        { revokedAt: { equals: null } },
      ],
    },
    overrideAccess: true,
  })
  await payload.delete({
    collection: 'oauth-tokens' as never,
    id: (live.docs[0] as { id: number }).id,
    overrideAccess: true,
  })
  check(
    'deleting the connection stops the access token at once',
    (await mcp(pair3.access_token, 'tools/list')).status === 401,
  )

  // Demoting an admin stops it at once; so does deleting the account.
  const second = await connect(adminCookie, claudeClient)
  const secondCode = (await approve(adminCookie, second.html)).location?.searchParams.get('code')
  const pair4 = (await (
    await exchange(second.registered.client_id, secondCode!, second.verifier, CLAUDE_CALLBACK)
  ).json()) as Pair
  check(
    'a second connection works',
    (await mcp(pair4.access_token, 'tools/list')).status === 200,
    `${second.page.status} ${second.html.slice(0, 200)}`,
  )
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { roles: ['member'] },
    overrideAccess: true,
  })
  check(
    'an account that stops being an admin loses the connection at once',
    (await mcp(pair4.access_token, 'tools/list')).status === 401,
  )
  await payload.update({
    collection: 'users',
    id: admin.id,
    data: { roles: ['admin'] },
    overrideAccess: true,
  })
  check(
    'and gets it back when it is an admin again',
    (await mcp(pair4.access_token, 'tools/list')).status === 200,
  )
  await payload.delete({ collection: 'users', id: admin.id, overrideAccess: true })
  accounts.splice(accounts.indexOf(admin.id), 1)
  check(
    'a deleted account stops at once',
    (await mcp(pair4.access_token, 'tools/list')).status === 401,
  )
  const left = await payload.count({
    collection: 'oauth-tokens' as never,
    where: { userId: { equals: String(admin.id) } },
    overrideAccess: true,
  })
  check('and leaves no token behind', left.totalDocs === 0, left.totalDocs)

  // A super admin may connect.
  const superCookie = await login(superAdmin.email, password)
  const superConnection = await connect(superCookie, chatgptClient, CHATGPT_CALLBACK)
  check(
    'a super admin sees the consent page (ChatGPT)',
    superConnection.page.status === 200 && /Let ChatGPT work on CILAS\?/.test(superConnection.html),
    superConnection.page.status,
  )
} finally {
  for (const id of accounts)
    await payload.delete({ collection: 'users', id, overrideAccess: true }).catch(() => undefined)
  for (const clientId of clientIds) {
    await payload
      .delete({
        collection: 'oauth-clients' as never,
        where: { clientId: { equals: clientId } },
        overrideAccess: true,
      })
      .catch(() => undefined)
  }
  await payload.destroy()
}

console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed')
process.exit(failures ? 1 : 0)
