import { Forbidden } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { User } from '@/payload-types'

import { applicationFixture, removeApplicationFixture } from '../../testing/application.fixture'

type Role = User['roles'][number]

let f: Awaited<ReturnType<typeof applicationFixture>>
const people: number[] = []
const users: number[] = []

const accountFor = async (roles: Role[], withAccount = true) => {
  const person = await f.payload.create({
    collection: 'people',
    data: {
      name: 'Fellow role probe',
      slug: `fellow-role-${crypto.randomUUID().slice(0, 8)}`,
    },
  })
  people.push(person.id)
  if (!withAccount) return { person: person.id, user: 0 }
  const user = await f.payload.create({
    collection: 'users',
    data: {
      email: `fellow-role-${crypto.randomUUID().slice(0, 8)}@cilas.test`,
      password: crypto.randomUUID(),
      roles,
      person: person.id,
    },
  })
  users.push(user.id)
  expect(await rolesOf(user.id)).toEqual(roles)
  return { person: person.id, user: user.id }
}

const account = (id: number) => f.payload.findByID({ collection: 'users', id, depth: 0 })
const rolesOf = async (id: number) => (await account(id)).roles
const actor = (user: User) => ({
  user: { ...user, collection: 'users' as const },
  overrideAccess: false as const,
})
const makeAdmin = async () => account((await accountFor(['admin'])).user)

const list = (course: number, fellows: number[], status: 'draft' | 'published' = 'published') =>
  f.payload.update({
    collection: 'courses',
    id: course,
    data: { fellows, _status: status },
    ...(status === 'draft' ? { draft: true } : {}),
  })

const courseListing = async (fellows: number[]) => {
  const course = await f.payload.create({
    collection: 'courses',
    data: {
      title: 'Fellow role probe',
      slug: `fellow-role-course-${crypto.randomUUID().slice(0, 8)}`,
      course_type: 'CORE',
      cycle: f.cycle.id,
      tier: 'public',
      _status: 'published',
      registration: { mode: 'follow_cycle' },
      fellows,
    },
  })
  return f.track('courses', course).id
}

beforeAll(async () => {
  f = await applicationFixture()
})
afterAll(async () => {
  if (!f) return
  for (const course of f.courses) await list(course.id, [])
  for (const id of users) await f.payload.delete({ collection: 'users', id })
  for (const id of people) await f.payload.delete({ collection: 'people', id })
  await removeApplicationFixture(f)
})

describe('propagateFellowRole', () => {
  it('grants fellow to the account of a newly listed person', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
  })

  it('grants nothing while the course is a draft: an admin approves co-fellows by publishing', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person], 'draft')
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('grants everyone listed when the course is published', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person], 'draft')
    await list(f.courses[0].id, [person])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
  })

  it('does nothing for a person with no account', async () => {
    const { person } = await accountFor([], false)
    await expect(list(f.courses[0].id, [person])).resolves.toMatchObject({ id: f.courses[0].id })
  })

  it('does not duplicate a role the account already holds', async () => {
    const { person, user } = await accountFor(['member', 'fellow'])
    await list(f.courses[0].id, [person])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
  })

  it('keeps every other role when granting', async () => {
    const { person, user } = await accountFor(['super_admin'])
    await list(f.courses[0].id, [person])
    expect(await rolesOf(user)).toEqual(['super_admin', 'fellow'])
  })

  it('revokes fellow when removed from their only course', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person])
    await list(f.courses[0].id, [])
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('keeps fellow when still listed on another course', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person])
    await list(f.courses[1].id, [person])
    await list(f.courses[0].id, [])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
    await list(f.courses[1].id, [])
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('keeps a co-fellow through an editor’s draft and revokes the role on admin approval', async () => {
    const editor = await accountFor(['member'])
    const coFellow = await accountFor(['member'])
    const course = await courseListing([editor.person, coFellow.person])
    const fellows = [editor.person]
    const asEditor = actor(await account(editor.user))
    const asAdmin = actor(await makeAdmin())

    await expect(
      f.payload.update({
        collection: 'courses',
        id: course,
        draft: true,
        data: { fellows, _status: 'draft' },
        ...asEditor,
      }),
    ).resolves.toMatchObject({ _status: 'draft' })
    expect(await rolesOf(coFellow.user)).toEqual(['member', 'fellow'])

    const publication = {
      collection: 'courses' as const,
      id: course,
      data: { fellows, _status: 'published' as const },
    }
    await expect(f.payload.update({ ...publication, ...asEditor })).rejects.toBeInstanceOf(
      Forbidden,
    )
    await expect(f.payload.update({ ...publication, ...asAdmin })).resolves.toMatchObject({
      _status: 'published',
      review: { status: 'approved' },
    })
    expect(await rolesOf(coFellow.user)).toEqual(['member'])
    expect(await rolesOf(editor.user)).toEqual(['member', 'fellow'])
  })

  it('reconciles against the live course when an admin restores an older publication', async () => {
    const first = await accountFor(['member'])
    const second = await accountFor(['member'])
    const third = await accountFor(['member'])
    const course = await courseListing([first.person])
    const asAdmin = actor(await makeAdmin())
    const {
      docs: [original],
    } = await f.payload.findVersions({
      collection: 'courses',
      where: { parent: { equals: course } },
      ...asAdmin,
    })
    await list(course, [second.person])
    await list(course, [third.person])
    expect(await rolesOf(third.user)).toEqual(['member', 'fellow'])

    await expect(
      f.payload.restoreVersion({
        collection: 'courses',
        id: original!.id,
        depth: 0,
        ...asAdmin,
      }),
    ).resolves.toMatchObject({ _status: 'published', fellows: [first.person] })
    expect(await rolesOf(third.user)).toEqual(['member'])
    expect(await rolesOf(first.user)).toEqual(['member', 'fellow'])
  })

  it('revokes after publication history is pruned, even if a never-published course lists the fellow', async () => {
    const { person, user } = await accountFor(['member'])
    const course = await courseListing([person])
    const draft = await f.payload.create({
      collection: 'courses',
      draft: true,
      data: {
        title: 'Never published',
        course_type: 'CORE',
        slug: `fellow-role-draft-${crypto.randomUUID()}`,
        fellows: [person],
      },
    })
    f.track('courses', draft)
    await list(course, [], 'draft')
    await f.payload.db.deleteVersions({
      collection: 'courses',
      where: {
        and: [{ parent: { equals: course } }, { 'version._status': { equals: 'published' } }],
      },
    })
    await expect(
      f.payload.findByID({ collection: 'courses', id: course, depth: 0 }),
    ).resolves.toMatchObject({ _status: 'published', fellows: [person] })
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])

    await list(course, [])
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('falls back to member when fellow was the only role', async () => {
    const { person, user } = await accountFor(['fellow'])
    await list(f.courses[0].id, [person])
    await list(f.courses[0].id, [])
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('ignores a save that changes nothing', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[0].id, [person])
    await list(f.courses[0].id, [person])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
  })
})

describe('revokeDeletedCourseFellows', () => {
  it('revokes fellow when the course is deleted', async () => {
    const { person, user } = await accountFor(['member'])
    const course = await courseListing([person])
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
    await f.payload.delete({ collection: 'courses', id: course })
    expect(await rolesOf(user)).toEqual(['member'])
  })

  it('keeps fellow when another course still lists them', async () => {
    const { person, user } = await accountFor(['member'])
    await list(f.courses[1].id, [person])
    const course = await courseListing([person])
    await f.payload.delete({ collection: 'courses', id: course })
    expect(await rolesOf(user)).toEqual(['member', 'fellow'])
    await list(f.courses[1].id, [])
  })
})
