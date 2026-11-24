import { createLocalReq, Forbidden, getPayload, type Payload, type Where } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { personOf } from './access'
import { mayRunEditorLocking } from './collections/LockedDocuments'
import config from './payload.config'
import type { PayloadLockedDocument, User } from './payload-types'
import { createTracker, uniq } from '../testing/payload.fixture'

let payload: Payload
let admin: User
let member: User
let editor: User
let otherEditor: User
let course: number
let otherCourse: number
const { track, cleanup } = createTracker()
const locks = 'payload-locked-documents' as const
const actor = (user: User) => ({
  user: { ...user, collection: 'users' as const },
  overrideAccess: false as const,
})
const holderOf = (user: User) => ({ relationTo: 'users' as const, value: user.id })
const courseRef = (id: number) => ({ relationTo: 'courses' as const, value: id })

const user = async (name: string, roles: User['roles'] = ['member']) =>
  track(
    'users',
    await payload.create({
      collection: 'users',
      data: { email: `${uniq(name)}@cilas.test`, password: 'test', roles },
    }),
  )

const draftCourse = async (name: string, editors: User[]) =>
  track(
    'courses',
    await payload.create({
      collection: 'courses',
      data: {
        title: name,
        slug: uniq(name),
        course_type: 'THEMATIC',
        tier: 'owner',
        fellows: editors.map((editor) => {
          const person = personOf(editor)
          if (person === null) throw new Error('Editor needs a person')
          return person
        }),
      },
      draft: true,
      ...actor(admin),
    }),
  ).id

beforeAll(async () => {
  payload = await getPayload({ config })
  admin = await user('lock-admin', ['admin'])
  member = await user('lock-member')
  editor = await user('lock-editor', ['fellow'])
  otherEditor = await user('lock-other-editor', ['fellow'])
  course = await draftCourse('lock-course', [editor, otherEditor])
  otherCourse = await draftCourse('lock-other-course', [editor])
})

afterAll(async () => {
  if (payload) {
    await cleanup(payload)
    await payload.destroy()
  }
})

const lockOn = async (id: number, holder: User, as: User = holder) =>
  track(
    locks,
    await payload.create({
      collection: locks,
      data: { document: courseRef(id), user: holderOf(holder) },
      depth: 0,
      ...actor(as),
    }),
  )

const patchLock = (
  id: number,
  data: Partial<Pick<PayloadLockedDocument, 'document' | 'globalSlug' | 'user'>>,
  as: User,
) => payload.update({ collection: locks, id, data, depth: 0, ...actor(as) })

const deleteLock = (id: number, as: User) => payload.delete({ collection: locks, id, ...actor(as) })

const lockLookup = (where: Where, as: User) =>
  payload.find({ collection: locks, where, depth: 0, ...actor(as) })

const courseWhere = (id: number) => ({
  'document.relationTo': { equals: 'courses' },
  'document.value': { equals: id },
})

describe('document locks', () => {
  it('cleans up the locks of a deleted user', async () => {
    const leaver = await user('lock-leaver')
    const gone = await lockOn(course, leaver, admin)
    const kept = await lockOn(otherCourse, member, admin)

    await payload.delete({ collection: 'users', id: leaver.id, ...actor(admin) })

    await expect(
      payload.findByID({ collection: locks, id: gone.id, ...actor(admin) }),
    ).rejects.toMatchObject({ status: 404 })
    await expect(
      payload.findByID({ collection: locks, id: kept.id, ...actor(admin) }),
    ).resolves.toMatchObject({ id: kept.id })
    await deleteLock(kept.id, admin)
  })

  it('allows permitted editors to acquire, look up, refresh, take over and release', async () => {
    await expect(lockOn(course, editor, otherEditor)).rejects.toBeInstanceOf(Forbidden)
    const lock = await lockOn(course, editor)
    try {
      const editViewWhere = {
        and: [courseWhere(course), { updatedAt: { greater_than: new Date(0).toISOString() } }],
      }
      await expect(lockLookup(editViewWhere, otherEditor)).resolves.toMatchObject({
        docs: [{ id: lock.id, user: holderOf(editor) }],
      })
      await expect(lockLookup(courseWhere(course), otherEditor)).resolves.toMatchObject({
        docs: [{ id: lock.id }],
      })
      await expect(deleteLock(lock.id, otherEditor)).rejects.toBeInstanceOf(Forbidden)
      await expect(
        patchLock(lock.id, { user: holderOf(editor) }, otherEditor),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        patchLock(
          lock.id,
          { user: { relationTo: 'courses' as 'users', value: editor.id } },
          editor,
        ),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        patchLock(
          lock.id,
          {
            user: { ...holderOf(editor), value: String(editor.id) as unknown as number },
          },
          editor,
        ),
      ).resolves.toMatchObject({ user: holderOf(editor) })
      await expect(
        patchLock(lock.id, { document: courseRef(otherCourse), user: holderOf(editor) }, editor),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(
        patchLock(lock.id, { user: holderOf(otherEditor) }, otherEditor),
      ).resolves.toMatchObject({
        document: courseRef(course),
        user: holderOf(otherEditor),
      })
      await expect(deleteLock(lock.id, editor)).rejects.toBeInstanceOf(Forbidden)
      await expect(deleteLock(lock.id, otherEditor)).resolves.toMatchObject({ id: lock.id })
    } finally {
      await deleteLock(lock.id, admin).catch(() => null)
    }
  })

  it('denies reads and writes on a private target to a member without access', async () => {
    const lock = await lockOn(otherCourse, member, admin)
    try {
      await expect(lockOn(otherCourse, member)).rejects.toBeInstanceOf(Forbidden)
      await expect(lockLookup(courseWhere(otherCourse), member)).rejects.toBeInstanceOf(Forbidden)
      await expect(
        payload.findByID({ collection: locks, id: lock.id, ...actor(member) }),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(patchLock(lock.id, { user: holderOf(member) }, member)).rejects.toBeInstanceOf(
        Forbidden,
      )
      await expect(
        patchLock(lock.id, { user: holderOf(otherEditor) }, otherEditor),
      ).rejects.toBeInstanceOf(Forbidden)
      await expect(deleteLock(lock.id, member)).rejects.toBeInstanceOf(Forbidden)
      await expect(payload.find({ collection: locks, ...actor(editor) })).rejects.toBeInstanceOf(
        Forbidden,
      )
      await expect(payload.count({ collection: locks, ...actor(editor) })).rejects.toBeInstanceOf(
        Forbidden,
      )
      const target = { collectionSlug: 'courses', id: otherCourse }
      await expect(
        mayRunEditorLocking(await createLocalReq(actor(member), payload), target),
      ).resolves.toBe(false)
      await expect(
        mayRunEditorLocking(await createLocalReq(actor(editor), payload), target),
      ).resolves.toBe(true)
    } finally {
      await deleteLock(lock.id, admin)
    }
  })
})

it('leaves a login lock in place for a member, then lets an admin clear it', async () => {
  const blocked = await user('login-locked')
  await payload.db.updateOne({
    collection: 'users',
    id: blocked.id,
    data: { lockUntil: new Date(Date.now() + 300_000).toISOString(), loginAttempts: 10 },
  })
  const unlockAs = (by: User) =>
    payload.unlock({
      collection: 'users',
      data: { email: blocked.email, password: 'unused-by-unlock' },
      ...actor(by),
    })
  const attempts = () =>
    payload.db.findOne<User>({
      collection: 'users',
      where: { id: { equals: blocked.id } },
    })
  await expect(unlockAs(member)).rejects.toBeInstanceOf(Forbidden)
  await expect(attempts()).resolves.toMatchObject({ loginAttempts: 10 })
  await expect(unlockAs(admin)).resolves.toBe(true)
  await expect(attempts()).resolves.toMatchObject({ lockUntil: null, loginAttempts: 0 })
})

it('restricts post and comment version lists, individual versions and counts to admins', async () => {
  const space = track(
    'spaces',
    await payload.create({
      collection: 'spaces',
      data: { kind: 'community', name: uniq('version-space') },
      ...actor(admin),
    }),
  )
  const post = track(
    'space-posts',
    await payload.create({
      collection: 'space-posts',
      data: { space: space.id, kind: 'discussion', body: 'Versioned post' },
      ...actor(admin),
    }),
  )
  const comment = track(
    'space-comments',
    await payload.create({
      collection: 'space-comments',
      data: { space: space.id, post: post.id, body: 'Versioned comment' },
      ...actor(admin),
    }),
  )

  for (const [collection, parent] of [
    ['space-posts', post.id],
    ['space-comments', comment.id],
  ] as const) {
    const where = { parent: { equals: parent } }
    const result = await payload.findVersions({ collection, where, ...actor(admin) })
    const version = result.docs[0]!
    await expect(
      payload.findVersionByID({ collection, id: version.id, ...actor(admin) }),
    ).resolves.toMatchObject({ id: version.id })
    await expect(
      payload.countVersions({ collection, where, ...actor(admin) }),
    ).resolves.toMatchObject({
      totalDocs: 1,
    })
    await expect(
      payload.findVersions({ collection, where, ...actor(member) }),
    ).rejects.toBeInstanceOf(Forbidden)
    await expect(
      payload.findVersionByID({ collection, id: version.id, ...actor(member) }),
    ).rejects.toBeInstanceOf(Forbidden)
    await expect(
      payload.countVersions({ collection, where, ...actor(member) }),
    ).rejects.toBeInstanceOf(Forbidden)
  }
})
