// @vitest-environment node
import { createLocalReq, getPayload, type Payload, type PayloadRequest } from 'payload'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { MCP_TOOLS } from '@/plugins/mcp'
import { NOT_ADMIN } from '@/plugins/mcp/tool'
import config from '@/payload.config'
import type { Course, User } from '@/payload-types'

import { createTracker, uniq, uniqEmail } from './fixtures'

let payload: Payload
const { track, cleanup } = createTracker()

type ToolOutput = { content: Array<{ type: string; text: string }>; isError?: boolean }

const tool = (name: string) => MCP_TOOLS.find((t) => t.name === name)!

/** A request signed in as the key's owner, as the plugin hands it to a tool. */
const requestFor = (user: User): Promise<PayloadRequest> =>
  createLocalReq({ user: { ...user, collection: 'users' } as never }, payload)

const call = async (name: string, user: User, args: Record<string, unknown>) => {
  const output = (await tool(name).handler(args, await requestFor(user), {})) as ToolOutput
  const text = output.content[0]!.text
  return { isError: Boolean(output.isError), text, json: output.isError ? null : JSON.parse(text) }
}

const mcpAccount = async (label: string, roles: User['roles']) =>
  (await payload.create({
    collection: 'users',
    data: { email: uniqEmail(`mcp-${label}`), password: crypto.randomUUID(), roles },
    overrideAccess: true,
  })) as unknown as User

describe('admin-only MCP server', () => {
  let admin: User
  let member: User
  let cycleId: number
  let personId: number
  const keys: number[] = []

  beforeAll(async () => {
    payload = await getPayload({ config: await config })
    const account = async (label: string, roles: User['roles']) =>
      track(
        'users',
        (await payload.create({
          collection: 'users',
          data: { email: uniqEmail(`mcp-${label}`), password: crypto.randomUUID(), roles },
          overrideAccess: true,
        })) as unknown as User,
      )
    admin = await account('admin', ['admin'])
    member = await account('member', ['member'])
    personId = track(
      'people',
      await payload.create({
        collection: 'people',
        data: { name: 'Mcp Probe Teacher', slug: uniq('mcp-teacher') },
        overrideAccess: true,
      }),
    ).id
    // A cycle needs a place; any one will do and it is not changed.
    const place = (
      await payload.find({ collection: 'places', limit: 1, depth: 0, overrideAccess: true })
    ).docs[0]!
    cycleId = track(
      'cycles',
      await payload.create({
        collection: 'cycles',
        data: { season: 'fall', start_year: 2090 + Math.floor(Math.random() * 9), place: place.id },
        overrideAccess: true,
      }),
    ).id
  })

  afterAll(async () => {
    vi.restoreAllMocks()
    for (const id of keys) {
      await payload
        .delete({ collection: 'payload-mcp-api-keys', id, overrideAccess: true })
        .catch(() => undefined)
    }
    await cleanup(payload)
    await payload.destroy()
  })

  describe('keys', () => {
    it('refuses a member a key and lets an admin make one', async () => {
      await expect(
        payload.create({
          collection: 'payload-mcp-api-keys',
          data: { label: 'member' } as never,
          user: { ...member, collection: 'users' } as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
      const key = await payload.create({
        collection: 'payload-mcp-api-keys',
        data: { label: 'admin', enableAPIKey: true, apiKey: crypto.randomUUID() } as never,
        user: { ...admin, collection: 'users' } as never,
        overrideAccess: false,
      })
      keys.push(key.id)
      const user = key.user
      expect(typeof user === 'object' ? user.id : user).toBe(admin.id)
    })

    it('shows keys to any admin without the secret, and hides them from others', async () => {
      const other = track(
        'users',
        (await payload.create({
          collection: 'users',
          data: { email: uniqEmail('mcp-other'), password: crypto.randomUUID(), roles: ['admin'] },
          overrideAccess: true,
        })) as unknown as User,
      )
      const asOther = await payload.find({
        collection: 'payload-mcp-api-keys',
        user: { ...other, collection: 'users' } as never,
        overrideAccess: false,
      })
      const seen = asOther.docs.find((d) => d.id === keys[0])
      expect(seen).toBeDefined()
      expect(seen).not.toHaveProperty('apiKey')
      expect(seen).not.toHaveProperty('apiKeyIndex')
      await expect(
        payload.find({
          collection: 'payload-mcp-api-keys',
          user: { ...member, collection: 'users' } as never,
          overrideAccess: false,
        }),
      ).rejects.toThrow()
    })
  })

  describe('tools list', () => {
    it('has the four tools and no default create, update, delete or find', () => {
      expect(MCP_TOOLS.map((t) => t.name).sort()).toEqual([
        'create_article_draft',
        'create_course_draft',
        'create_form_and_link',
        'lookup',
      ])
    })

    it('answers tools/list over the endpoint with the same four and refuses no key', async () => {
      const endpoint = payload.config.endpoints.find(
        (e) => e.path === '/mcp' && e.method === 'post',
      )!
      const send = async (
        authorization: string | null,
        method: string,
        params: Record<string, unknown> = {},
      ) => {
        const req = await requestFor(admin)
        const headers = new Headers({
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          ...(authorization ? { authorization } : {}),
        })
        Object.assign(req, {
          url: 'http://localhost:3000/api/mcp',
          method: 'POST',
          headers,
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        })
        return endpoint.handler(req)
      }
      const unauthorized = await send(null, 'tools/list')
      expect(unauthorized.status).toBe(401)
      expect(unauthorized.headers.get('www-authenticate')).toMatch(
        /resource_metadata="[^"]+\/\.well-known\/oauth-protected-resource"/,
      )

      const owner = await mcpAccount('endpoint-owner', ['admin'])
      const secret = crypto.randomUUID()
      await payload.create({
        collection: 'payload-mcp-api-keys',
        data: {
          user: owner.id,
          label: 'endpoint test',
          enableAPIKey: true,
          apiKey: secret,
          'payload-mcp-tool': {
            lookup: true,
            createCourseDraft: true,
            createArticleDraft: true,
            createFormAndLink: true,
          },
        } as never,
        overrideAccess: true,
      })
      const listing = await (await send(`Bearer ${secret}`, 'tools/list')).text()
      for (const name of [
        'lookup',
        'create_course_draft',
        'create_article_draft',
        'create_form_and_link',
      ]) {
        expect(listing).toContain(`"${name}"`)
      }
      expect(listing).not.toMatch(/"(find|create|update|delete)[A-Z]/)

      await payload.update({
        collection: 'users',
        id: owner.id,
        data: { roles: ['member'] },
        overrideAccess: true,
      })
      const refused = await (
        await send(`Bearer ${secret}`, 'tools/call', {
          name: 'lookup',
          arguments: { kind: 'cycles' },
        })
      ).text()
      expect(refused).toContain('not an administrator any more')
    })

    it('removes the keys of a deleted account', async () => {
      const owner = await mcpAccount('deleted-owner', ['admin'])
      const key = await payload.create({
        collection: 'payload-mcp-api-keys',
        data: { user: owner.id, label: 'to remove' } as never,
        overrideAccess: true,
      })
      await payload.delete({ collection: 'users', id: owner.id, overrideAccess: true })
      const left = await payload.find({
        collection: 'payload-mcp-api-keys',
        where: { id: { equals: key.id } },
        overrideAccess: true,
      })
      expect(left.totalDocs).toBe(0)
    })
  })

  describe('a non-admin key owner', () => {
    it.each([
      ['lookup', { kind: 'courses' }],
      ['create_course_draft', { title: { en: 'x' }, course_type: 'CORE', cycle: 1 }],
      ['create_article_draft', { title: { en: 'x' }, authors: [1] }],
      [
        'create_form_and_link',
        { title: { en: 'x' }, questions: [{ type: 'text', name: 'q', label: { en: 'Q' } }] },
      ],
    ])('is refused by %s', async (name, args) => {
      const result = await call(name, member, args)
      expect(result.isError).toBe(true)
      expect(result.text).toBe(NOT_ADMIN)
    })
  })

  describe('create_course_draft', () => {
    let courseId: number

    it('makes a draft in both languages with valid rich text', async () => {
      const { json, isError, text } = await call('create_course_draft', admin, {
        title: { en: uniq('Mcp Course'), ar: 'دورة الاختبار' },
        summary: { en: 'One line', ar: 'سطر واحد' },
        description: {
          en: '# Heading\n\nA **bold** idea and a [link](https://example.org).\n\n- one\n- two',
          ar: 'فقرة عربية\n\n> اقتباس',
        },
        course_type: 'THEMATIC',
        cycle: cycleId,
        fellows: [personId],
        teaching_languages: ['ar', 'en'],
        location: ['ONLINE'],
        registration: { method: 'closed' },
      })
      expect(isError, text).toBe(false)
      courseId = track('courses', json).id
      expect(json.status).toBe('draft')
      expect(json.admin_path).toBe(`/admin/collections/courses/${courseId}`)
      expect(json.locales).toEqual(['en', 'ar'])

      const live = await payload.findByID({
        collection: 'courses',
        id: courseId,
        draft: false,
        depth: 0,
        overrideAccess: true,
      })
      expect(live._status).toBe('draft')
      const versions = await payload.findVersions({
        collection: 'courses',
        where: { parent: { equals: courseId } },
        overrideAccess: true,
      })
      expect(versions.docs.length).toBeGreaterThan(0)
      expect(versions.docs.every((v) => v.version._status === 'draft')).toBe(true)
      const published = await payload.count({
        collection: 'courses',
        where: { and: [{ id: { equals: courseId } }, { _status: { equals: 'published' } }] },
        overrideAccess: true,
      })
      expect(published.totalDocs).toBe(0)
      expect(live.tier).toBe('owner')
      expect(live.review?.status).toBe('draft')

      for (const locale of ['en', 'ar'] as const) {
        const doc = (await payload.findByID({
          collection: 'courses',
          id: courseId,
          locale,
          fallbackLocale: false,
          draft: true,
          depth: 0,
          overrideAccess: true,
        })) as Course
        expect(doc.title).toBeTruthy()
        expect(doc.summary).toBeTruthy()
        const root = (
          doc.description as { root: { type: string; children: Array<{ type: string }> } }
        ).root
        expect(root.type).toBe('root')
        expect(root.children.length).toBeGreaterThan(0)
      }
      const english = (await payload.findByID({
        collection: 'courses',
        id: courseId,
        locale: 'en',
        draft: true,
        depth: 0,
        overrideAccess: true,
      })) as Course
      const types = (
        english.description as { root: { children: Array<{ type: string }> } }
      ).root.children.map((c) => c.type)
      expect(types).toEqual(expect.arrayContaining(['heading', 'paragraph', 'list']))
      expect(english.registration?.method).toBe('closed')
      expect(english.cycle).toBe(cycleId)
    })

    it('names a missing cycle instead of failing in the database', async () => {
      const result = await call('create_course_draft', admin, {
        title: { en: uniq('No cycle') },
        course_type: 'CORE',
        cycle: 999_999_999,
      })
      expect(result.isError).toBe(true)
      expect(result.text).toMatch(/Cycle 999999999 not found/)
    })

    it('leaves nothing behind when the Arabic step fails', async () => {
      const title = uniq('Atomic course')
      const real = payload.update.bind(payload)
      const spy = vi.spyOn(payload, 'update').mockImplementation((async (args: never) => {
        if ((args as { collection: string }).collection === 'courses') throw new Error('boom')
        return real(args)
      }) as never)
      const result = await call('create_course_draft', admin, {
        title: { en: title, ar: 'عنوان' },
        course_type: 'CORE',
        cycle: cycleId,
      })
      spy.mockRestore()
      expect(result.isError).toBe(true)
      const found = await payload.count({
        collection: 'courses',
        where: { title: { equals: title } },
        locale: 'en',
        overrideAccess: true,
      })
      expect(found.totalDocs).toBe(0)
    })
  })

  describe('create_form_and_link', () => {
    it('keeps a published course as it was and drafts the link beside it', async () => {
      const course = track(
        'courses',
        await payload.create({
          collection: 'courses',
          data: {
            _status: 'published',
            title: uniq('Live course'),
            slug: uniq('live-course'),
            course_type: 'CORE',
            cycle: cycleId,
            tier: 'public',
            registration: { method: 'closed' },
          } as never,
          user: { ...admin, collection: 'users' } as never,
          overrideAccess: true,
        }),
      )
      expect(course._status).toBe('published')

      const { json, isError, text } = await call('create_form_and_link', admin, {
        title: { en: uniq('Mcp form'), ar: 'نموذج' },
        questions: [
          {
            type: 'textarea',
            name: 'motivation',
            label: { en: 'Why?', ar: 'لماذا؟' },
            required: true,
          },
          {
            type: 'radio',
            name: 'days',
            label: { en: 'Days' },
            options: [{ en: 'Weekdays', ar: 'أيام الأسبوع' }, { en: 'Weekends' }],
          },
        ],
        link: { target: 'course', id: course.id },
      })
      expect(isError, text).toBe(false)
      const formId = track('forms', json.form).id
      expect(json.linked_course.status).toBe('draft')

      const live = await payload.findByID({
        collection: 'courses',
        id: course.id,
        draft: false,
        depth: 0,
        overrideAccess: true,
      })
      expect(live._status).toBe('published')
      expect(live.registration?.method).toBe('closed')
      expect(live.registration?.form ?? null).toBeNull()

      const draft = await payload.findByID({
        collection: 'courses',
        id: course.id,
        draft: true,
        depth: 0,
        overrideAccess: true,
      })
      expect(draft.registration?.method).toBe('form')
      expect(draft.registration?.form).toBe(formId)
      expect(draft._status).toBe('draft')

      const form = await payload.findByID({
        collection: 'forms',
        id: formId,
        locale: 'all',
        depth: 0,
        overrideAccess: true,
      })
      const blocks = (form.fields ?? []) as unknown as Array<Record<string, unknown>>
      expect(blocks.map((b) => b.name)).toEqual(['name', 'email', 'motivation', 'days'])
      const motivation = blocks[2] as { label: Record<string, string> }
      expect(motivation.label).toEqual({ en: 'Why?', ar: 'لماذا؟' })
    })

    it('refuses to link a cycle and creates nothing', async () => {
      const title = uniq('Cycle form')
      const result = await call('create_form_and_link', admin, {
        title: { en: title },
        questions: [{ type: 'text', name: 'q', label: { en: 'Q' } }],
        link: { target: 'cycle', id: cycleId },
      })
      expect(result.isError).toBe(true)
      expect(result.text).toMatch(/cycle has no drafts/)
      const found = await payload.count({
        collection: 'forms',
        where: { title: { equals: title } },
        overrideAccess: true,
      })
      expect(found.totalDocs).toBe(0)
    })

    it('refuses name and email as questions', async () => {
      const result = await call('create_form_and_link', admin, {
        title: { en: 'x' },
        questions: [{ type: 'text', name: 'email', label: { en: 'Email' } }],
      })
      expect(result.isError).toBe(true)
      expect(result.text).toMatch(/already/)
    })
  })

  describe('create_article_draft', () => {
    it('makes a draft with an Arabic body and shows what footnote markers do', async () => {
      const { json, isError, text } = await call('create_article_draft', admin, {
        title: { en: uniq('Mcp Article'), ar: 'مقال' },
        body: { en: 'First paragraph with a note.[^1]\n\n[^1]: The note text.', ar: 'فقرة' },
        authors: [personId],
        tags: ['probe'],
        requested_tier: 'public',
      })
      expect(isError, text).toBe(false)
      const id = track('articles', json).id
      expect(json.status).toBe('draft')
      const live = await payload.findByID({
        collection: 'articles',
        id,
        draft: false,
        depth: 0,
        overrideAccess: true,
      })
      expect(live._status).toBe('draft')
      expect(live.tier).toBe('owner')
      expect(live.featured ?? false).toBe(false)
      const en = await payload.findByID({
        collection: 'articles',
        id,
        locale: 'en',
        draft: true,
        depth: 0,
        overrideAccess: true,
      })
      // Footnotes are inline blocks on the site; Markdown markers are not converted.
      const paragraphs = (
        en.body as unknown as {
          root: {
            children: Array<{ type: string; children: Array<{ type: string; text?: string }> }>
          }
        }
      ).root.children
      expect(paragraphs.map((p) => p.type)).toEqual(['paragraph', 'paragraph'])
      expect(paragraphs[0]!.children.map((c) => c.text).join('')).toBe(
        'First paragraph with a note.[^1]',
      )
      expect(paragraphs[1]!.children[0]!.text).toBe('[^1]: The note text.')
      expect(json.notes.join(' ')).toMatch(/not real footnotes/)
    })
  })

  describe('lookup', () => {
    const allowed = new Set(['id', 'title', 'slug', 'status', 'admin_path'])

    it.each(['cycles', 'programmes', 'courses', 'articles', 'forms', 'people'])(
      'returns only safe fields for %s',
      async (kind) => {
        const { json, isError, text } = await call('lookup', admin, { kind, limit: 25 })
        expect(isError, text).toBe(false)
        for (const row of json.results) {
          expect(Object.keys(row).every((key) => allowed.has(key))).toBe(true)
        }
        expect(text).not.toMatch(/@|enrollments|submissions|email/i)
      },
    )

    it('finds a draft course by its English or Arabic title', async () => {
      const byEnglish = await call('lookup', admin, { kind: 'courses', query: 'Mcp Course' })
      expect(byEnglish.json.results.some((r: { status?: string }) => r.status === 'draft')).toBe(
        true,
      )
      const byArabic = await call('lookup', admin, { kind: 'courses', query: 'دورة الاختبار' })
      expect(byArabic.json.results.length).toBeGreaterThan(0)
    })
  })
})
