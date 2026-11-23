import { getPayload, type Payload } from 'payload'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { applicantsFor, countWaitingApplicants } from '@/forms/applicants'
import { relId } from '@/lib/relation'
import { adminQueue, adminReviewRows } from '@/lib/review-queue'
import { statusInputOf, statusOf, type ReviewedDoc } from '@/lib/review-status'
import { REVIEWED } from '@/lib/reviewed-collections'
import type { ReviewedCollection } from '@/lib/reviewed-fields'
import { countsOf, rowsOf, workSetsOf } from '@/portal/needs/needs'
import { needsTotal } from '@/portal/needs/sources'
import { ownRows, ownSet } from '@/portal/needs/owner-rows'
import config from '@/payload.config'
import type { User } from '@/payload-types'

import { localServices } from '../testing/local-services.test-utils'
import { mockNetwork } from '../testing/msw-node.test-utils'
const onNeedsCopy = /@localhost:5433\/cilas_(needs|ttfb)(\?|$)/.test(process.env.DATABASE_URL ?? '')

mockNetwork(...localServices)

let payload: Payload
if (onNeedsCopy) {
  beforeAll(async () => {
    payload = await getPayload({ config: await config })
  }, 300_000)
  afterAll(async () => {
    await payload.destroy()
  })
}

type Pg = { query: (sql: string) => Promise<{ rows: Array<{ id: number }> }> }
const pgOf = (payload: Payload) => (payload.db as unknown as { pool: Pg }).pool

const accountIds = async (payload: Payload) => {
  const one = async (role: string, sql: string) => {
    const { rows } = await pgOf(payload).query(sql)
    if (!rows[0]) throw new Error(`no ${role} account on this copy`)
    return rows[0].id
  }
  return {
    admin: await one(
      'admin',
      `select u.id from users u where u.activated_at is not null
         and exists (select 1 from users_roles r where r.parent_id = u.id and r.value in ('admin', 'super_admin'))
       order by u.id limit 1`,
    ),
    fellow: await one(
      'fellow',
      `select u.id from users u where u.person_id is not null
         and exists (select 1 from users_roles r where r.parent_id = u.id and r.value = 'fellow')
       order by (select count(*) from courses_rels c where c.path = 'fellows' and c.people_id = u.person_id) desc, u.id
       limit 1`,
    ),
    student: await one(
      'student',
      `select u.id from users u where u.person_id is not null
         and exists (select 1 from users_roles r where r.parent_id = u.id and r.value = 'member')
       order by (select count(*) from enrollments e where e.status = 'accepted' and e.person_id = u.person_id) desc, u.id
       limit 1`,
    ),
  }
}

const userOf = async (payload: Payload, id: number) =>
  (await payload.findByID({
    collection: 'users',
    id,
    depth: 0,
    overrideAccess: true,
  })) as unknown as User

type Ids = Record<ReviewedCollection, Set<number>>

const oracleQueue = async (payload: Payload) => {
  const entries = await Promise.all(
    REVIEWED.map(async ({ collection }) => {
      const local = { depth: 0, pagination: false, overrideAccess: true } as const
      const [{ docs }, { docs: versions }] = await Promise.all([
        payload.find({
          collection,
          where: { 'review.status': { equals: 'submitted' } },
          select: { updatedAt: true },
          ...local,
        }),
        payload.findVersions({
          collection,
          where: {
            and: [
              { latest: { equals: true } },
              { 'version.review.status': { equals: 'submitted' } },
            ],
          },
          select: { parent: true },
          ...local,
        }),
      ])
      const ids = new Set<number>()
      for (const version of versions) ids.add(Number(relId(version.parent as number)))
      for (const doc of docs) ids.add(doc.id)
      return [collection, ids] as const
    }),
  )
  return Object.fromEntries(entries) as Ids
}

const sizeOf = (ids: Ids) => Object.values(ids).reduce((sum, set) => sum + set.size, 0)

const oracleChoices = async (payload: Payload) => {
  const { applications } = await applicantsFor(payload, { kind: 'admin' }, 'en')
  return applications.reduce(
    (sum, application) =>
      sum + application.choices.filter((choice) => choice.decision === 'pending').length,
    0,
  )
}

type State = {
  main: { _status: string | null; review: string | null } | null
  latest: { _status: string | null; review: string | null } | null
}

const LIVE = 'published'
const rule = {
  R1: ({ main, latest }: State) =>
    main?._status === LIVE &&
    main.review === 'submitted' &&
    !(latest && latest._status === 'draft' && latest.review === 'submitted'),
  R2: ({ main, latest }: State) =>
    !!main &&
    main._status !== LIVE &&
    main.review !== 'submitted' &&
    main.review !== 'changes_requested' &&
    latest?.review === 'submitted',
  R3: ({ main, latest }: State) =>
    main?._status === LIVE &&
    main.review !== 'submitted' &&
    latest?.review === 'submitted' &&
    latest._status !== 'draft',
  R4: ({ main, latest }: State) =>
    !!main &&
    main._status !== LIVE &&
    (main.review === 'submitted' || main.review === 'changes_requested') &&
    !!latest &&
    ((latest.review !== 'submitted' && main.review === 'submitted') || latest._status === LIVE),
  R5: ({ main }: State) => main === null,
}

const ruleOf = (state: State) => {
  const hits = (Object.keys(rule) as Array<keyof typeof rule>).filter((name) => rule[name](state))
  if (hits.length > 1) throw new Error(`the rules overlap: ${hits.join(', ')}`)
  return hits[0] ?? null
}

type Detail = {
  collection: ReviewedCollection
  id: number
  state: State
  key: string | null
  createdAt: string | null
  rule: string | null
}

const detailOf = async (payload: Payload, collection: ReviewedCollection, id: number) => {
  const { docs } = await payload.find({
    collection,
    where: { id: { equals: id } },
    depth: 0,
    limit: 1,
    pagination: false,
    overrideAccess: true,
  })
  const main = (docs[0] as unknown as ReviewedDoc | undefined) ?? null
  const { docs: versions } = await payload.findVersions({
    collection,
    where: { and: [{ parent: { equals: id } }, { latest: { equals: true } }] },
    sort: '-updatedAt',
    limit: 1,
    depth: 0,
    pagination: false,
    overrideAccess: true,
  })
  const version = versions[0]?.version as unknown as ReviewedDoc | undefined
  const latest = version ? { ...version, id } : null
  const state: State = {
    main: main ? { _status: main._status ?? null, review: main.review?.status ?? null } : null,
    latest: latest
      ? { _status: latest._status ?? null, review: latest.review?.status ?? null }
      : null,
  }
  return {
    collection,
    id,
    state,
    key: main
      ? statusOf(statusInputOf({ collection, main, latest, read: 'full' }), () => undefined)
      : null,
    createdAt: (main as { createdAt?: string } | null)?.createdAt ?? null,
    rule: ruleOf(state),
  } satisfies Detail
}

const minus = (a: Ids, b: Ids) =>
  REVIEWED.flatMap(({ collection }) =>
    [...a[collection]].filter((id) => !b[collection].has(id)).map((id) => ({ collection, id })),
  )

const nearestRank = (sorted: number[], p: number) =>
  sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]!

const time = async (run: () => Promise<unknown>) => {
  for (let i = 0; i < 3; i++) await run()
  const samples: number[] = []
  for (let i = 0; i < 20; i++) {
    const start = performance.now()
    await run()
    samples.push(performance.now() - start)
  }
  samples.sort((a, b) => a - b)
  return { p50: nearestRank(samples, 50), p75: nearestRank(samples, 75) }
}

describe.skipIf(!onNeedsCopy)('needs against the queue of trunk, on a prod clone', () => {
  it('differs from trunk only by the rules of Deviation 21', async () => {
    const admin = await userOf(payload, (await accountIds(payload)).admin)
    const oracle = await oracleQueue(payload)
    const choices = await oracleChoices(payload)
    const sets = await workSetsOf(payload, admin)
    const result = await rowsOf(payload, admin, sets, 'en')
    const total = needsTotal(result)

    const needsIds: Ids = Object.fromEntries(
      REVIEWED.map(({ collection }) => [
        collection,
        new Set(sets.reviewQueue?.[collection]?.keys()),
      ]),
    ) as Ids
    const reviewRows = result.rows.filter((row) => row.collection !== null).length
    const onlyOracle = await Promise.all(
      minus(oracle, needsIds).map(({ collection, id }) => detailOf(payload, collection, id)),
    )
    const onlyNeeds = await Promise.all(
      minus(needsIds, oracle).map(({ collection, id }) => detailOf(payload, collection, id)),
    )

    const print = (label: string, details: Detail[]) =>
      console.log(
        `${label} (${details.length})\n${details.map((d) => JSON.stringify(d)).join('\n')}`,
      )
    console.log(`dump: ${process.env.NEEDS_DUMP ?? 'not given'}`)
    console.log(
      JSON.stringify({
        oracleQueue: sizeOf(oracle),
        oracleChoices: choices,
        needsTotal: total,
        countsTotal: countsOf(sets).total,
        queueRows: reviewRows,
        totalRows: result.rows.length,
        failed: result.failed,
      }),
    )
    print(
      'onlyOracle',
      onlyOracle.filter((d) => d.rule !== 'R5'),
    )
    print(
      'onlyOracle R5 (orphan versions)',
      onlyOracle.filter((d) => d.rule === 'R5'),
    )
    print('onlyNeeds', onlyNeeds)

    expect(sizeOf(oracle)).toBeGreaterThan(0)
    expect(choices).toBeGreaterThan(0)
    expect(result.failed).toEqual([])
    expect(onlyNeeds).toEqual([])
    expect(onlyOracle.filter((d) => d.rule === null)).toEqual([])
    const queue = sizeOf(oracle) - onlyOracle.length
    expect(total).toBe(queue + choices)
    expect(result.rows.length).toBe(queue + 1)
    expect(countsOf(sets).total).toBe(total)
  }, 300_000)
})

describe.skipIf(!onNeedsCopy || process.env.NEEDS_COST !== '1')(
  'the cost of needs, per role',
  () => {
    const report = (role: string, row: Record<string, { p50: number; p75: number }>) => {
      const fmt = (n: number) => n.toFixed(1)
      console.log(
        `cost ${role} (ms, p50/p75 of 20 after 3 warm-ups)\n${Object.entries(row)
          .map(([name, t]) => `  ${name.padEnd(24)} ${fmt(t.p50)} / ${fmt(t.p75)}`)
          .join('\n')}`,
      )
    }

    it('admin', { timeout: 600_000 }, async () => {
      const admin = await userOf(payload, (await accountIds(payload)).admin)
      const sets = await workSetsOf(payload, admin)
      const row = {
        oracleQueue: await time(() => oracleQueue(payload)),
        adminQueue: await time(() => adminQueue(payload)),
        adminReviewRows: await time(() => adminReviewRows(payload, sets.reviewQueue!, 'en')),
        countWaitingApplicants: await time(() => countWaitingApplicants(payload, admin)),
        workSetsOf: await time(() => workSetsOf(payload, admin)),
        rowsOf: await time(() => rowsOf(payload, admin, sets, 'en')),
      }
      report('admin', row)
      expect(row.adminQueue.p75 + row.adminReviewRows.p75).toBeLessThanOrEqual(
        1.5 * row.oracleQueue.p75,
      )
      expect(row.workSetsOf.p75).toBeLessThanOrEqual(150)
    })

    for (const role of ['fellow', 'student'] as const) {
      it(role, { timeout: 600_000 }, async () => {
        const user = await userOf(payload, (await accountIds(payload))[role])
        const sets = await workSetsOf(payload, user)
        const row: Record<string, { p50: number; p75: number }> = {
          ownSetArticles: await time(() => ownSet(payload, user, 'articles')),
          ownSetCourses: await time(() => ownSet(payload, user, 'courses')),
          ownRowsArticles: await time(() =>
            ownRows(payload, user, 'articles', sets.ownArticles ?? new Map(), 'en'),
          ),
          ownRowsCourses: await time(() =>
            ownRows(payload, user, 'courses', sets.ownCourses ?? new Map(), 'en'),
          ),
          workSetsOf: await time(() => workSetsOf(payload, user)),
          rowsOf: await time(() => rowsOf(payload, user, sets, 'en')),
        }
        report(role, row)
        expect(row.workSetsOf!.p75).toBeLessThanOrEqual(150)
      })
    }
  },
)
