// @vitest-environment node
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { getPayload, type Payload, type PayloadRequest } from 'payload'
import { SignJWT, decodeJwt, decodeProtectedHeader } from 'jose'
import { Client } from 'typesense'
import { spawnSync } from 'node:child_process'
import config from '@/payload.config'
import type { Space, SpacePost, User } from '@/payload-types'
import { ALIAS, CursorReset, inputSchema, numericId, projection } from '@/lib/private-search/model'
import { searchPrivate, SelectionDenied } from '@/lib/private-search/search'
import { processOutbox, rebuild, pruneGenerations, WRITER_LOCK } from '@/lib/private-search/worker'
import { POST } from '@/app/(frontend)/api/spaces-search/route'
import { activeGeneration, RecoveryRequired } from '@/lib/private-search/generation'
import { rateAllowed } from '@/lib/private-search/rate'

const disposable =
  process.env.DATABASE_URL === 'postgres://search_test:disposable@localhost:55439/cilas_search_test'
const run = Date.now().toString(36)
const client = new Client({
  apiKey: 'disposable-search-test-key',
  nodes: [{ host: '127.0.0.1', port: 18109, protocol: 'http' }],
  numRetries: 0,
  logLevel: 'silent',
})

describe.skipIf(!disposable)('private search with real Postgres and Typesense 30.2', () => {
  let payload: Payload
  let readClient: Client
  let alice: User
  let bob: User
  let admin: User
  let courseA: number
  let a: Space
  let b: Space
  let community: Space
  let first: SpacePost
  let enrollment: number
  let token: string
  let helloId: number
  const search = (user: User, query: string, rest: Record<string, unknown> = {}) =>
    searchPrivate({
      payload,
      client: readClient,
      user,
      input: inputSchema.parse({ query, ...rest }),
      secret: payload.secret,
    })
  const updatePost = (id: number, data: Record<string, unknown>) =>
    payload.update({ collection: 'space-posts', id, data, overrideAccess: true, depth: 0 })
  const post = (space: Space, body: string) =>
    payload.create({
      collection: 'space-posts',
      overrideAccess: true,
      depth: 0,
      data: { space: space.id, body, kind: 'discussion' },
    })
  const request = (body: unknown, key = token) =>
    POST(
      new Request('http://localhost/api/spaces-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(key ? { Authorization: `JWT ${key}` } : {}),
        },
        body: JSON.stringify(body),
      }),
    )
  const drain = async () => {
    await payload.db.pool.query('UPDATE spaces_search_outbox SET available_at = now()')
    for (let i = 0; i < 10; i++) {
      const result = await processOutbox(payload, client)
      expect(result?.failed).toBe(0)
      if (!result?.processed) return
    }
    throw new Error('Unexpected unbounded queue')
  }
  beforeAll(async () => {
    payload = await getPayload({ config })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: { spaces_mode: 'on' },
      overrideAccess: true,
    })
    const user = async (name: string, roles: User['roles'] = ['member']) =>
      payload.create({
        collection: 'users',
        overrideAccess: true,
        data: {
          email: `search-${name}-${run}@example.test`,
          password: 'disposable-test-password',
          roles,
        },
      })
    alice = await user('alice')
    bob = await user('bob')
    admin = await user('admin', ['admin'])
    const place = await payload.create({
      collection: 'places',
      data: { name: 'Search Test', slug: `search-${run}`, city: 'Cairo' },
    })
    const cycle = await payload.create({
      collection: 'cycles',
      data: { season: 'spring', start_year: 2032, place: place.id, start_date: '2032-03-04' },
    })
    const course = async (suffix: string, user: User) => {
      const c = await payload.create({
        collection: 'courses',
        data: {
          title: `Search ${suffix}`,
          slug: `search-${suffix}-${run}`,
          course_type: 'THEMATIC',
          session_unit: 'session',
          tier: 'owner',
          cycle: cycle.id,
          _status: 'published',
        } as never,
      })
      const e = await payload.create({
        collection: 'enrollments',
        data: { course: c.id, person: numericId(user.person)!, status: 'confirmed' } as never,
      })
      const s = (
        await payload.find({
          collection: 'spaces',
          depth: 0,
          overrideAccess: true,
          where: { course: { equals: c.id } },
        })
      ).docs[0]
      return { c, e, s }
    }
    const ca = await course('a', alice)
    const cb = await course('b', bob)
    a = ca.s
    b = cb.s
    courseA = ca.c.id
    enrollment = ca.e.id
    community = await payload.create({
      collection: 'spaces',
      data: { kind: 'community', name: 'Shared search' },
      depth: 0,
    })
    first = await post(a, 'needle astronomy مرحبا القاهرة')
    await post(b, 'needle confidential unrelated')
    await post(community, 'needle shared learning')
    token = (
      await payload.login({
        collection: 'users',
        data: { email: alice.email, password: 'disposable-test-password' },
      })
    ).token!
    const built = await rebuild(payload, client)
    expect(built?.generation).toMatch(/^spaces_search_[a-f0-9]{32}$/)
    const readKey = await client.keys().create({
      description: 'Disposable private server search',
      actions: ['documents:search'],
      collections: ['^spaces_search(_[a-f0-9]{32})?$'],
    })
    readClient = new Client({
      apiKey: readKey.value!,
      nodes: [{ host: '127.0.0.1', port: 18109, protocol: 'http' }],
      numRetries: 0,
      logLevel: 'silent',
    })
  })
  afterAll(async () => {
    await payload?.destroy()
  })

  it('reports an active writer as healthy and an abandoned writer as requiring recovery', async () => {
    const connection = await payload.db.pool.connect()
    const token = '123e4567-e89b-12d3-a456-426614174000'
    const status = () => {
      const result = spawnSync(
        process.execPath,
        ['--conditions=production', '.maintenance/run.mjs', 'status'],
        {
          env: process.env,
          encoding: 'utf8',
          timeout: 20000,
        },
      )
      const line = result.stdout.split('\n').find((line) => line.startsWith('{"pending":'))
      expect(line).toBeDefined()
      return { code: result.status, value: JSON.parse(line!) }
    }
    try {
      await connection.query('SELECT pg_advisory_lock($1)', [WRITER_LOCK])
      await connection.query('UPDATE spaces_search_state SET writer_token = $1 WHERE id = 1', [
        token,
      ])
      expect(status()).toMatchObject({
        code: 0,
        value: { initialized: true, writer_active: true, recovery_required: false },
      })
      await connection.query('SELECT pg_advisory_unlock($1)', [WRITER_LOCK])
      expect(status()).toMatchObject({
        code: 1,
        value: { initialized: true, writer_active: false, recovery_required: true },
      })
    } finally {
      await connection.query(
        'UPDATE spaces_search_state SET writer_token = NULL WHERE id = 1 AND writer_token = $1',
        [token],
      )
      await connection.query('SELECT pg_advisory_unlock_all()')
      connection.release()
    }
  }, 60000)

  it('uses current intro gating for posts and comments, then recloses after deleting the introduction', async () => {
    const gated = await search(alice, 'needle')
    expect(gated.results.map((r) => r.space)).toEqual(['Shared search'])
    expect(gated.aggregates?.facets.find((facet) => facet.id === a.id)?.found).toBe(0)
    const intro = numericId(a.introduction_post)!
    await payload.create({
      collection: 'space-comments',
      data: {
        space: b.id,
        post: intro,
        author: numericId(alice.person)!,
        body: 'Forged relationship must not introduce a member',
      },
    })
    expect((await search(alice, 'needle', { space: a.id })).results).toEqual([])
    const publicIntro = await payload.create({
      collection: 'space-comments',
      data: {
        space: a.id,
        post: intro,
        author: numericId(bob.person),
        body: 'needle introduction',
      },
      depth: 0,
    })
    await drain()
    expect((await search(alice, 'needle', { space: a.id })).results.map((r) => r.id)).toContain(
      `comment:${publicIntro.id}`,
    )
    const hello = await payload.create({
      collection: 'space-comments',
      data: { space: a.id, post: intro, author: numericId(alice.person), body: 'Hello' },
      depth: 0,
    })
    helloId = hello.id
    expect((await search(alice, 'needle', { space: a.id })).results.map((r) => r.id)).toContain(
      `post:${first.id}`,
    )
    await payload.update({
      collection: 'space-comments',
      id: hello.id,
      data: { deleted_at: new Date().toISOString() },
    })
    expect((await search(alice, 'needle', { space: a.id })).results.map((r) => r.id)).not.toContain(
      `post:${first.id}`,
    )
    await payload.update({ collection: 'space-comments', id: hello.id, data: { deleted_at: null } })
  })
  it('isolates disjoint spaces and rejects forged selection, while including the overlapping community', async () => {
    const result = await search(alice, 'needle')
    expect(result.results.map((r) => r.id)).toContain(`post:${first.id}`)
    expect(JSON.stringify(result)).not.toContain('confidential')
    expect(result.spaces.map((s) => s.id)).not.toContain(b.id)
    await expect(search(alice, 'needle', { space: b.id })).rejects.toBeInstanceOf(SelectionDenied)
    expect((await search(bob, 'needle')).results.every((r) => r.space !== 'Search a')).toBe(true)
  })
  it('returns live validated facets independently of multi-selection and supports none and browsing', async () => {
    const all = await search(alice, 'needle')
    expect(all.aggregates).not.toBeNull()
    expect(all.aggregates!.total).toBe(all.results.length)
    expect(all.aggregates!.facets.map((facet) => facet.id)).not.toContain(b.id)
    const one = await search(alice, 'needle', { spaces: [a.id] })
    expect(one.results.every((row) => row.spaceId === a.id)).toBe(true)
    expect(one.aggregates!.facets).toEqual(all.aggregates!.facets)
    expect(one.aggregates!.total).toBe(
      all.aggregates!.facets.find((facet) => facet.id === a.id)!.found,
    )
    const none = await search(alice, 'needle', { spaces: [] })
    expect(none.results).toEqual([])
    expect(none.aggregates!.total).toBe(0)
    expect(none.aggregates!.facets).toEqual(all.aggregates!.facets)
    await expect(search(alice, 'needle', { spaces: [a.id, b.id] })).rejects.toBeInstanceOf(
      SelectionDenied,
    )
    const alphabetical = await search(alice, '', { spaces: [a.id, community.id], sort: 'alpha' })
    expect(alphabetical.incomplete).toBe(false)
    expect(alphabetical.results.map((row) => row.title)).toEqual(
      alphabetical.results.map((row) => row.title).sort((a, b) => a.localeCompare(b, 'en')),
    )
  })
  it('exposes an authorized thumbnail through the existing private file route only', async () => {
    const data = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=',
      'base64',
    )
    const file = await payload.create({
      collection: 'space-files',
      overrideAccess: true,
      depth: 0,
      data: { space: a.id, post: first.id, filename: 'search-thumbnail.png' },
      file: { data, mimetype: 'image/png', name: 'search-thumbnail.png', size: data.length },
    })
    try {
      const result = await search(alice, 'needle', { spaces: [a.id] })
      expect(result.results.find((row) => row.id === `post:${first.id}`)?.image).toBe(
        `/api/space-files/file/${encodeURIComponent(file.filename!)}`,
      )
      expect(
        (await search(bob, 'needle')).results.some((row) => row.image?.includes(file.filename!)),
      ).toBe(false)
    } finally {
      await payload.delete({ collection: 'space-files', id: file.id, overrideAccess: true })
    }
  })
  it('suppresses edited-away matches during an index outage and excludes soft/hard deleted threads', async () => {
    await updatePost(first.id, { body: 'replacement astronomy' })
    expect((await search(alice, 'needle')).results.map((r) => r.id)).not.toContain(
      `post:${first.id}`,
    )
    await drain()
    expect((await search(alice, 'replacement')).results.map((r) => r.id)).toContain(
      `post:${first.id}`,
    )
    await updatePost(first.id, { body: 'needle astronomy مرحبا القاهرة' })
    await drain()
    const parent = await payload.create({
      collection: 'space-comments',
      data: { space: a.id, post: first.id, body: 'needle old parent' },
      depth: 0,
    })
    const child = await payload.create({
      collection: 'space-comments',
      data: { space: a.id, post: first.id, parent: parent.id, body: 'needle live child' },
      depth: 0,
    })
    const otherPost = await post(a, 'other thread')
    const badParent = await payload.create({
      collection: 'space-comments',
      data: {
        space: a.id,
        post: otherPost.id,
        parent: parent.id,
        body: 'needle mismatched parent',
      },
    })
    const tooDeep = await payload.create({
      collection: 'space-comments',
      data: {
        space: a.id,
        post: first.id,
        parent: child.id,
        body: 'needle invisible nested reply',
      },
    })
    await drain()
    await payload.update({
      collection: 'space-comments',
      id: parent.id,
      data: { deleted_at: new Date().toISOString() },
    })
    const visible = (await search(alice, 'needle')).results.map((r) => r.id)
    expect(visible).not.toContain(`comment:${parent.id}`)
    expect(visible).toContain(`comment:${child.id}`)
    expect(visible).not.toContain(`comment:${badParent.id}`)
    expect(visible).not.toContain(`comment:${tooDeep.id}`)
    await updatePost(first.id, { deleted_at: new Date().toISOString() })
    expect((await search(alice, 'needle')).results.map((r) => r.id)).not.toContain(
      `comment:${child.id}`,
    )
    await updatePost(first.id, { deleted_at: null })
    await drain()
    await payload.delete({ collection: 'space-comments', id: parent.id })
    expect((await search(alice, 'needle')).results.map((r) => r.id)).not.toContain(
      `comment:${child.id}`,
    )
    await drain()
    expect((await search(alice, 'needle')).results.map((r) => r.id)).toContain(
      `comment:${child.id}`,
    )
    const gone = await post(a, 'harddeleteprobe')
    await drain()
    await payload.delete({ collection: 'space-posts', id: gone.id })
    expect((await search(alice, 'harddeleteprobe')).results).toEqual([])
    await drain()
    expect(
      (
        await client
          .collections(ALIAS)
          .documents()
          .search({ q: 'harddeleteprobe', query_by: 'body' })
      ).found,
    ).toBe(0)
  })
  it('takes withdrawal, Trial/Off and audience changes directly from Postgres', async () => {
    await payload.update({
      collection: 'enrollments',
      id: enrollment,
      data: { status: 'withdrawn' } as never,
    })
    expect((await search(alice, 'needle')).results.map((r) => r.id)).not.toContain(
      `post:${first.id}`,
    )
    await payload.update({
      collection: 'enrollments',
      id: enrollment,
      data: { status: 'confirmed' } as never,
    })
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        spaces_mode: 'trial',
        spaces_trial_courses: [courseA],
        spaces_trial_community: false,
      },
    })
    expect((await search(alice, 'needle')).spaces.map((s) => s.id)).toEqual([a.id])
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'off' } })
    const spy = vi.spyOn(readClient, 'collections')
    expect((await search(alice, 'needle')).results).toEqual([])
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    expect((await search(admin, 'needle')).results.length).toBeGreaterThan(0)
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'on' } })
    await payload.update({ collection: 'spaces', id: community.id, data: { audience: 'admins' } })
    expect((await search(alice, 'needle')).spaces.map((s) => s.id)).not.toContain(community.id)
    await payload.update({ collection: 'spaces', id: community.id, data: { audience: 'all' } })
  })
  it('authenticates requests, rejects arbitrary engine input and never returns raw metadata or cacheable responses', async () => {
    const expired = await new SignJWT({
      ...decodeJwt(token),
      exp: Math.floor(Date.now() / 1000) - 1,
    })
      .setProtectedHeader({ alg: 'HS256', authVersion: decodeProtectedHeader(token).authVersion })
      .sign(new TextEncoder().encode(payload.secret))
    for (const key of ['', 'expired.invalid.token', expired])
      expect((await request({ query: 'needle' }, key)).status).toBe(401)
    for (const body of [
      { query: 'needle', filter_by: 'spaceId:>0' },
      { searches: [] },
      { query: 'needle', pinned_hits: 'post:1:1' },
      { query: 'needle', highlight_full_fields: 'body' },
    ]) {
      expect((await request(body)).status).toBe(400)
    }
    const response = await request({ query: 'needle' })
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toContain('private, no-store')
    const result = await response.json()
    expect(Object.keys(result).sort()).toEqual([
      'account',
      'aggregates',
      'hasMore',
      'incomplete',
      'results',
      'spaces',
    ])
    expect(JSON.stringify(result)).not.toMatch(/sourceRevision|search_time|out_of|matched_tokens/)
    await payload.update({ collection: 'users', id: alice.id, data: { sessions: [] } })
    expect((await request({ query: 'needle' })).status).toBe(401)
    token = (
      await payload.login({
        collection: 'users',
        data: { email: alice.email, password: 'disposable-test-password' },
      })
    ).token!
  })
  it('refreshes demotion and linked-person changes even with the original valid token', async () => {
    const adminToken = (
      await payload.login({
        collection: 'users',
        data: { email: admin.email, password: 'disposable-test-password' },
      })
    ).token!
    await payload.update({ collection: 'users', id: admin.id, data: { roles: ['member'] } })
    const result = await (await request({ options: true }, adminToken)).json()
    expect(result.spaces.map((s: { id: number }) => s.id)).not.toContain(a.id)
    const newPerson = await payload.create({
      collection: 'people',
      data: { name: 'New unlinked person', slug: `new-person-${run}` },
    })
    await payload.update({ collection: 'users', id: alice.id, data: { person: newPerson.id } })
    const changed = await (await request({ options: true })).json()
    expect(changed.spaces.map((s: { id: number }) => s.id)).not.toContain(a.id)
    await payload.update({
      collection: 'users',
      id: alice.id,
      data: { person: numericId(alice.person)! },
    })
  })
  it('rolls back the outbox together with uncommitted content and retains committed work after worker restart', async () => {
    const before = Number(
      (await payload.db.pool.query('SELECT count(*) FROM spaces_search_outbox')).rows[0].count,
    )
    const transactionID = await payload.db.beginTransaction()
    expect(transactionID).toBeTruthy()
    const uncommitted = await payload.create({
      collection: 'space-posts',
      data: { space: a.id, body: 'rollbackprobe', kind: 'discussion' },
      req: { transactionID } as Partial<PayloadRequest>,
      depth: 0,
    })
    await processOutbox(payload, client)
    expect(
      (await client.collections(ALIAS).documents().search({ q: 'rollbackprobe', query_by: 'body' }))
        .found,
    ).toBe(0)
    await payload.db.rollbackTransaction(transactionID!)
    expect(
      (await payload.find({ collection: 'space-posts', where: { id: { equals: uncommitted.id } } }))
        .docs,
    ).toEqual([])
    expect(
      Number(
        (await payload.db.pool.query('SELECT count(*) FROM spaces_search_outbox')).rows[0].count,
      ),
    ).toBeLessThanOrEqual(before)
    const lateTransaction = await payload.db.beginTransaction()
    const late = await payload.create({
      collection: 'space-posts',
      data: { space: a.id, kind: 'discussion', body: 'latecommitprobe' },
      req: { transactionID: lateTransaction } as Partial<PayloadRequest>,
      depth: 0,
    })
    await post(a, 'committed later sequence first')
    await rebuild(payload, client)
    expect((await search(alice, 'latecommitprobe')).results).toEqual([])
    await payload.db.commitTransaction(lateTransaction!)
    expect(
      (
        await payload.db.pool.query('SELECT id FROM spaces_search_outbox WHERE source_id = $1', [
          late.id,
        ])
      ).rows.length,
    ).toBeGreaterThan(0)
    await drain()
    expect((await search(alice, 'latecommitprobe')).results.map((r) => r.id)).toContain(
      `post:${late.id}`,
    )
    const persisted = await post(a, 'crashrecoveryprobe')
    await drain()
    expect((await search(alice, 'crashrecoveryprobe')).results.map((r) => r.id)).toContain(
      `post:${persisted.id}`,
    )
  })
  it('retries partial imports without exposing engine errors and serializes delayed/duplicate/reordered jobs', async () => {
    const target = await post(a, 'orderingprobe original')
    const importing = vi.spyOn(client.collections(ALIAS).documents(), 'import')
    // A real partial failure proves SDK behavior, not a mock of the engine.
    const partialError = await client
      .collections(ALIAS)
      .documents()
      .import([projection('post', target)!, { id: 'bad', body: 'PRIVATE_SENTINEL' }], {
        action: 'upsert',
        throwOnFail: true,
      })
      .catch((error: unknown) => error)
    expect(partialError).toBeInstanceOf(Error)
    importing.mockRestore()
    const dead = new Client({
      apiKey: 'disposable-search-test-key',
      nodes: [{ host: '127.0.0.1', port: 19998, protocol: 'http' }],
      connectionTimeoutSeconds: 0.1,
      numRetries: 0,
      logLevel: 'silent',
    })
    const uncertain = await processOutbox(payload, dead)
    expect(uncertain?.recoveryRequired).toBe(true)
    await expect(processOutbox(payload, client)).rejects.toBeInstanceOf(RecoveryRequired)
    await rebuild(payload, client)
    await updatePost(target.id, { body: 'orderingprobe original' })
    const generation = (await client.aliases(ALIAS).retrieve()).collection_name
    const collection = client.collections(generation)
    const documents = collection.documents()
    vi.spyOn(documents, 'import').mockRejectedValueOnce(partialError)
    const failed = await processOutbox(payload, client)
    expect(failed?.failed).toBeGreaterThan(0)
    expect(JSON.stringify(failed)).not.toContain('PRIVATE_SENTINEL')
    expect(
      (
        await payload.db.pool.query(
          'SELECT attempts FROM spaces_search_outbox WHERE source_id = $1',
          [target.id],
        )
      ).rows.some((r: { attempts: number }) => r.attempts > 0),
    ).toBe(true)
    vi.restoreAllMocks()
    await payload.db.pool.query('UPDATE spaces_search_outbox SET available_at = now()')
    const originalImport = documents.import.bind(documents)
    let release!: () => void
    let entered!: () => void
    const ready = new Promise<void>((r) => {
      entered = r
    })
    const blocked = new Promise<void>((r) => {
      release = r
    })
    const hook = vi.spyOn(documents, 'import').mockImplementationOnce(async (...args) => {
      entered()
      await blocked
      return originalImport(...args)
    })
    const old = processOutbox(payload, client)
    await ready
    expect(await processOutbox(payload, client)).toBeNull()
    await updatePost(target.id, { body: 'orderingprobe latest' })
    release()
    await old
    hook.mockRestore()
    await payload.db.pool.query(
      "INSERT INTO spaces_search_outbox (kind, source_id) VALUES ('post', $1), ('post', $1)",
      [target.id],
    )
    await drain()
    expect((await search(alice, 'latest')).results.map((r) => r.id)).toContain(`post:${target.id}`)
    expect((await search(alice, 'original')).results.map((r) => r.id)).not.toContain(
      `post:${target.id}`,
    )
  })
  it('fences a delayed write after a real Postgres writer connection loss into the old generation', async () => {
    const target = await post(a, 'fencingprobe obsolete')
    const oldGeneration = await activeGeneration(payload)
    const documents = client.collections(oldGeneration).documents()
    const importing = documents.import.bind(documents)
    let release!: () => void
    let entered!: () => void
    const ready = new Promise<void>((r) => {
      entered = r
    })
    const blocked = new Promise<void>((r) => {
      release = r
    })
    const hook = vi.spyOn(documents, 'import').mockImplementationOnce(async (...args) => {
      entered()
      await blocked
      return importing(...args)
    })
    const old = processOutbox(payload, client).catch((error: unknown) => error)
    await ready
    await payload.db.pool.query(
      "SELECT pg_terminate_backend(pid) FROM pg_locks WHERE locktype = 'advisory' AND objid = 192834711",
    )
    await expect(processOutbox(payload, client)).rejects.toBeInstanceOf(RecoveryRequired)
    await updatePost(target.id, { body: 'fencingprobe latest' })
    await rebuild(payload, client)
    const recovered = await activeGeneration(payload)
    expect(recovered).not.toBe(oldGeneration)
    release()
    expect(await old).toBeInstanceOf(RecoveryRequired)
    hook.mockRestore()
    expect(await activeGeneration(payload)).toBe(recovered)
    expect((await search(alice, 'fencingprobe')).results[0].snippet).toBe('fencingprobe latest')
  })
  it('keeps the serving generation and backlog when a rebuild alias acknowledgement is lost', async () => {
    const serving = await activeGeneration(payload)
    await post(a, 'acknowledgementprobe')
    const aliases = client.aliases()
    const upsert = aliases.upsert.bind(aliases)
    const hook = vi.spyOn(aliases, 'upsert').mockImplementationOnce(async (...args) => {
      await upsert(...args)
      throw new Error('Simulated lost acknowledgement')
    })
    await expect(rebuild(payload, client)).rejects.toThrow('Simulated')
    hook.mockRestore()
    expect(await activeGeneration(payload)).toBe(serving)
    expect(
      Number(
        (await payload.db.pool.query('SELECT count(*) FROM spaces_search_outbox')).rows[0].count,
      ),
    ).toBeGreaterThan(0)
    await expect(processOutbox(payload, client)).rejects.toBeInstanceOf(RecoveryRequired)
    await rebuild(payload, client)
    expect((await search(alice, 'acknowledgementprobe')).results.length).toBe(1)
  })
  it('rebuilds under a writer lease and replays edits/deletes committed while scanning', async () => {
    const target = await post(a, 'rebuildprobe obsolete')
    await drain()
    let edited = false
    const find = payload.find.bind(payload)
    const during = vi
      .spyOn(payload, 'find')
      .mockImplementation(async (options: Parameters<Payload['find']>[0]) => {
        const result = await find(options)
        if (!edited && options.collection === 'space-posts' && options.sort === 'id') {
          edited = true
          await updatePost(target.id, { body: 'rebuildprobe latest' })
          await payload.delete({ collection: 'space-comments', id: helloId })
        }
        return result
      })
    const old = (await client.aliases(ALIAS).retrieve()).collection_name
    await rebuild(payload, client)
    during.mockRestore()
    expect((await client.aliases(ALIAS).retrieve()).collection_name).not.toBe(old)
    // Deleting the intro re-closes the gate, independent of the freshly built index.
    expect((await search(alice, 'latest', { space: a.id })).results).toEqual([])
    const hello = await payload.create({
      collection: 'space-comments',
      data: {
        space: a.id,
        post: numericId(a.introduction_post)!,
        author: numericId(alice.person)!,
        body: 'Hello again',
      },
    })
    helloId = hello.id
    expect((await search(alice, 'rebuildprobe')).results[0].snippet).toBe('rebuildprobe latest')
  })
  it('resets cursors on permission/generation/query/account changes and refills rejected candidates without raw totals', async () => {
    for (let i = 0; i < 24; i++) await post(a, `pagingprobe ${i}`)
    await drain()
    const page = await search(alice, 'pagingprobe')
    expect(page.results).toHaveLength(20)
    expect(page.hasMore).toBe(true)
    const next = await search(alice, 'pagingprobe', { cursor: page.cursor })
    expect(next.results).toHaveLength(4)
    expect(next.hasMore).toBe(false)
    expect(next.results.every((r) => !page.results.some((p) => p.id === r.id))).toBe(true)
    await expect(search(alice, 'changedquery', { cursor: page.cursor })).rejects.toBeInstanceOf(
      CursorReset,
    )
    await expect(search(bob, 'pagingprobe', { cursor: page.cursor })).rejects.toBeInstanceOf(
      CursorReset,
    )
    await payload.updateGlobal({
      slug: 'site-settings',
      data: {
        spaces_mode: 'trial',
        spaces_trial_courses: [courseA],
        spaces_trial_community: false,
      },
    })
    await expect(search(alice, 'pagingprobe', { cursor: page.cursor })).rejects.toBeInstanceOf(
      CursorReset,
    )
    await payload.updateGlobal({ slug: 'site-settings', data: { spaces_mode: 'on' } })
    await rebuild(payload, client)
    await expect(search(alice, 'pagingprobe', { cursor: page.cursor })).rejects.toBeInstanceOf(
      CursorReset,
    )
    for (const hit of page.results.slice(0, 8))
      await updatePost(Number(hit.id.split(':')[1]), { body: 'edited without worker' })
    const refilled = await search(alice, 'pagingprobe')
    expect(refilled.results).toHaveLength(16)
    expect(refilled.hasMore).toBe(false)
    expect(refilled.incomplete).toBe(false)
  })
  it('caps rejected candidates, reports incompleteness and keeps candidate payloads free of text/highlights', async () => {
    const generation = (await client.aliases(ALIAS).retrieve()).collection_name
    const ghosts = Array.from({ length: 205 }, (_, i) =>
      projection('post', {
        id: 1000000 + i,
        space: a.id,
        body: 'capbudgetprobe',
        updatedAt: new Date().toISOString(),
      })!,
    )
    await client.collections(generation).documents().import(ghosts, { action: 'upsert' })
    const documents = readClient.collections(generation).documents()
    const spy = vi.spyOn(documents, 'search')
    const result = await search(alice, 'capbudgetprobe')
    expect(result.results).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result.incomplete).toBe(true)
    expect(result.aggregates).toBeNull()
    expect(spy).toHaveBeenCalledTimes(5)
    for (const returned of spy.mock.results) {
      const response = await returned.value
      expect(
        response.hits.every(
          (h: { document: object; highlights?: unknown[]; highlight?: object }) =>
            !('body' in h.document) &&
            !('title' in h.document) &&
            !h.highlights?.length &&
            !Object.keys(h.highlight ?? {}).length,
        ),
      ).toBe(true)
    }
    spy.mockRestore()
    await client.collections(generation).documents().delete({ filter_by: 'sourceId:>=1000000' })
  })
  it('handles Arabic/English fixtures and bounds excessive authenticated requests', async () => {
    expect((await search(alice, 'القاهرة')).results.map((r) => r.id)).toContain(`post:${first.id}`)
    expect((await search(alice, 'astronomy')).results.map((r) => r.id)).toContain(
      `post:${first.id}`,
    )
    await payload.db.pool.query('DELETE FROM spaces_search_rate')
    for (let i = 0; i < 45; i++)
      expect(await rateAllowed(payload, alice.id, 'local-test', payload.secret)).toBe(true)
    expect(await rateAllowed(payload, alice.id, 'local-test', payload.secret)).toBe(false)
  })
  it('records a reproducible sequential synthetic workload without logging queries or bodies', async () => {
    const samples: number[] = []
    let queries = 0
    const find = payload.find.bind(payload)
    const spy = vi
      .spyOn(payload, 'find')
      .mockImplementation(async (options: Parameters<Payload['find']>[0]) => {
        queries++
        return find(options)
      })
    for (let i = 0; i < 25; i++) {
      const start = performance.now()
      await search(alice, 'needle')
      samples.push(performance.now() - start)
    }
    spy.mockRestore()
    samples.sort((a, b) => a - b)
    const indexed = (await client.collections(await activeGeneration(payload)).retrieve())
      .num_documents
    console.info(
      JSON.stringify({
        workload: '25 sequential synthetic searches',
        indexed,
        payloadFindsPerSearch: queries / 25,
        p50ms: Number(samples[12].toFixed(2)),
        p95ms: Number(samples[23].toFixed(2)),
        testProcessRSSMiB: Math.round(process.memoryUsage().rss / 1048576),
      }),
    )
    expect(samples).toHaveLength(25)
  })
  it('denies public keys on private generations/alias, JOIN, export and key APIs and rejects curation bypass', async () => {
    const key = await client.keys().create({
      description: 'Disposable public search test',
      actions: ['documents:search'],
      collections: ['^(courses|articles|people)(_[0-9a-f]{8})?$'],
    })
    const publicClient = new Client({
      apiKey: key.value!,
      nodes: [{ host: '127.0.0.1', port: 18109, protocol: 'http' }],
      numRetries: 0,
      logLevel: 'silent',
    })
    const generation = (await client.aliases(ALIAS).retrieve()).collection_name
    for (const collection of [ALIAS, generation]) {
      await expect(
        publicClient.collections(collection).documents().search({ q: '*', query_by: 'body' }),
      ).rejects.toMatchObject({ httpStatus: 401 })
      await expect(publicClient.collections(collection).documents().export()).rejects.toMatchObject(
        { httpStatus: 401 },
      )
    }
    await expect(publicClient.keys().retrieve()).rejects.toMatchObject({ httpStatus: 401 })
    const publicName = 'courses'
    try {
      await client.collections(publicName).delete()
    } catch {}
    await client
      .collections()
      .create({ name: publicName, fields: [{ name: 'title', type: 'string' }] })
    await client.collections(publicName).documents().create({ id: '1', title: 'public' })
    const joined = await publicClient
      .collections(publicName)
      .documents()
      .search({ q: '*', query_by: 'title', include_fields: `$${generation}(*)` })
    expect(joined.hits?.map((h) => h.document)).toEqual([{ id: '1', title: 'public' }])
    await expect(
      publicClient
        .collections(publicName)
        .documents()
        .search({ q: '*', query_by: 'title', filter_by: `$${generation}(spaceId:>0)` }),
    ).rejects.toThrow()
    const hidden = (
      await payload.find({
        collection: 'space-posts',
        where: { space: { equals: b.id } },
        depth: 0,
        limit: 10,
        overrideAccess: true,
      })
    ).docs.find((p) => p.body.includes('confidential'))!
    await client.curationSets('private-test-curation').upsert({
      items: [
        {
          id: 'private-pin',
          rule: { query: 'curationprobe', match: 'exact' },
          includes: [
            { id: `post:${hidden.id}`, position: 1 },
            { id: `post:${first.id}`, position: 2 },
          ],
        },
      ],
    })
    await client.collections(generation).update({ curation_sets: ['private-test-curation'] })
    const curated = await client
      .collections(generation)
      .documents()
      .search({ q: 'curationprobe', query_by: 'body' })
    expect(curated.hits?.map((h) => ('id' in h.document ? h.document.id : null))).toContain(
      `post:${hidden.id}`,
    )
    expect((await search(alice, 'curationprobe')).results).toEqual([])
    // Server-owned request ignores even a pinned document and returns no stored highlights.
    const engine = await client
      .collections(generation)
      .documents()
      .search({
        q: 'needle',
        query_by: 'body',
        filter_by: `spaceId:=${a.id}`,
        pinned_hits: `post:${hidden.id}:1`,
        filter_curated_hits: true,
        highlight_fields: 'none',
        highlight_full_fields: '',
        enable_highlight_v1: false,
      })
    expect(JSON.stringify(engine.hits)).not.toContain('confidential')
    expect(
      engine.hits?.every(
        (h) => (h.highlights?.length ?? 0) === 0 && Object.keys(h.highlight ?? {}).length === 0,
      ),
    ).toBe(true)
    const writerKey = await client.keys().create({
      description: 'Disposable private writer',
      actions: ['collections:*', 'documents:import', 'documents:delete', 'aliases:*'],
      collections: ['^spaces_search(_[a-f0-9]{32})?$'],
    })
    const scopedWriter = new Client({
      apiKey: writerKey.value!,
      nodes: [{ host: '127.0.0.1', port: 18109, protocol: 'http' }],
      numRetries: 0,
      logLevel: 'silent',
    })
    expect((await processOutbox(payload, scopedWriter))?.failed).toBe(0)
    expect((await rebuild(payload, scopedWriter))?.generation).toMatch(/^spaces_search_/)
    expect((await pruneGenerations(payload, scopedWriter))?.removed).toBeGreaterThan(0)
    await client.keys(writerKey.id).delete()
    await client.keys(key.id).delete()
  })
})
