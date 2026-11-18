import type { SanitizedConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import config from '@/payload.config'

import { auditAccess, UPSTREAM } from './access-audit'

const namedAs = <Rule extends (...args: never[]) => unknown>(name: string, rule: Rule) =>
  Object.defineProperty(rule, 'name', { value: name })

const probe = (...fields: { name: string; access: Record<string, unknown> }[]) =>
  auditAccess({
    collections: [
      { slug: 'probe', access: {}, fields: fields.map((field) => ({ type: 'text', ...field })) },
    ],
    globals: [],
  } as unknown as SanitizedConfig).problems.filter((problem) =>
    problem.startsWith('collection:probe'),
  )

describe('access audit', () => {
  it('names every rule of the config and finds no problem', async () => {
    const { rows, problems } = auditAccess(await config)
    const rules = (entity: string, field: string) =>
      rows.find((row) => row.entity === entity && row.field === field)?.rules

    expect(problems).toEqual([])
    expect(rules('collection:articles', 'tier')).toEqual({
      create: 'adminOnlyField',
      read: 'open',
      update: 'adminOnlyField',
    })
    expect(rules('collection:articles', 'review.review_note')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(rules('collection:articles', 'title')).toEqual({
      create: 'open',
      read: 'open',
      update: 'open',
    })
    expect(rules('collection:enrollments', 'assessment')).toEqual({
      create: 'open',
      read: 'assessor',
      update: 'assessor',
    })
    expect(rules('collection:space-preferences', 'account')).toMatchObject({ update: 'nobody' })
    expect(rules('collection:courses', 'registration')).toMatchObject({
      create: 'adminOnlyField',
      update: 'adminOnlyField',
    })
    expect(rules('collection:courses', 'registration.mode')).toMatchObject({
      create: 'open',
      update: 'open',
    })
    expect(rules('collection:articles', '*')).toMatchObject({
      read: 'readTiers(ownsVia(authors),drafts)',
      update:
        'adminPublishes(isAdminOrOwn(ownsVia(authors),while={"_status":{"in":["draft","published"]}}))',
    })
    expect(rules('collection:users', 'salt')).toEqual({
      create: 'payload:auth',
      read: 'open',
      update: 'payload:auth',
    })
    expect(rules('global:site-settings', '*')).toMatchObject({ read: 'isAdmin', update: 'isAdmin' })
    expect(
      rows.some((row) => row.entity === 'collection:courses' && row.field === 'applicants'),
    ).toBe(false)
  })

  it('matches the committed snapshot', async () => {
    const { rows } = auditAccess(await config)
    await expect(`${JSON.stringify(rows, null, 2)}\n`).toMatchFileSnapshot(
      './access-audit.snapshot.json',
    )
  })

  it('fails on a rule with no name', () => {
    expect(probe({ name: 'value', access: { update: () => false } })).toEqual([
      'collection:probe value update: unnamed rule',
    ])
  })

  it('fails on a factory rule built from an unnamed rule', () => {
    expect(
      probe({
        name: 'value',
        access: { update: namedAs('adminPublishes(anonymous)', () => true) },
      }),
    ).toEqual(['collection:probe value update: unnamed rule'])
  })

  it('fails when one name holds two different rules', () => {
    expect(
      probe(
        { name: 'one', access: { update: namedAs('ownRows', () => true) } },
        { name: 'two', access: { update: namedAs('ownRows', () => false) } },
      ),
    ).toEqual([
      'collection:probe two update: ownRows also names a different rule at collection:probe one update',
    ])
  })

  it('fails when a factory leaves its inner name on two rules', () => {
    const factory = () => namedAs('inner', () => true)
    expect(
      probe(
        { name: 'one', access: { update: factory() } },
        { name: 'two', access: { update: factory() } },
      ),
    ).toEqual([
      'collection:probe two update: inner names two functions; a factory must name its rules',
    ])
  })

  it('fails on an UPSTREAM entry the config no longer has', () => {
    const { problems } = auditAccess({ collections: [], globals: [] } as unknown as SanitizedConfig)
    expect(problems).toHaveLength(UPSTREAM.length)
    expect(problems).toContain(
      'collection:users salt create: no such rule; remove it from UPSTREAM',
    )
  })
})
