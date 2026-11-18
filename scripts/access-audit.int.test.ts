import type { CollectionConfig, SanitizedConfig } from 'payload'
import { describe, expect, it } from 'vitest'

import config, { sourceConfig } from '@/payload.config'
import { overrideApiKeyCollection } from '@/plugins/mcp/api-keys'

import { auditAccess, srcOverlapsUpstream, UPSTREAM } from './access-audit'

const audited = Promise.resolve(config).then(auditAccess)

const namedAs = <Rule extends (...args: never[]) => unknown>(name: string, rule: Rule) =>
  Object.defineProperty(rule, 'name', { value: name })

const probeAudit = (
  collection: Record<string, unknown>,
  ...fields: { name: string; access?: Record<string, unknown> }[]
) =>
  auditAccess({
    collections: [
      {
        slug: 'probe',
        access: {},
        ...collection,
        fields: fields.map((field) => ({ type: 'text', ...field })),
      },
    ],
    globals: [],
  } as unknown as SanitizedConfig)

const probe = (...fields: { name: string; access: Record<string, unknown> }[]) =>
  probeAudit({}, ...fields).problems.filter((problem) => problem.startsWith('collection:probe'))

const entityRules = (collection: Record<string, unknown>) =>
  probeAudit(collection).rows.find((row) => row.field === '*')?.rules

describe('access audit', () => {
  it('names every rule of the config and finds no problem', async () => {
    const { rows, problems } = await audited
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
    expect(rules('collection:users', '*')).toMatchObject({
      admin: 'payload:loggedIn',
      unlock: 'payload:defaultUnlock',
    })
    expect(rules('collection:oauth-auth-codes', '*')).toMatchObject({
      read: 'plugin:mcp-oauth:denyPublic',
    })
    expect(rules('global:site-settings', '*')).toMatchObject({ read: 'isAdmin', update: 'isAdmin' })
    expect(
      rows.some((row) => row.entity === 'collection:courses' && row.field === 'applicants'),
    ).toBe(false)
  })

  it('matches the committed snapshot', async () => {
    const { rows, problems } = await audited
    expect(problems).toEqual([])
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

  it('prints the operations that Payload resolves with no rule', () => {
    expect(entityRules({ auth: {}, versions: { drafts: true } })).toEqual({
      admin: 'payload:loggedIn',
      readVersions: 'payload:loggedIn',
    })
    expect(entityRules({ auth: false, versions: false })).toEqual({})
    expect(
      entityRules({
        versions: { drafts: true },
        access: { readVersions: namedAs('own', () => true) },
      }),
    ).toEqual({ readVersions: 'own' })
  })

  it('does not print readDrafts, which Payload has no rule for', () => {
    expect(Object.keys(entityRules({ versions: { drafts: true } }) ?? {})).not.toContain(
      'readDrafts',
    )
  })

  it('reads the access of a named tab', () => {
    const tab = {
      name: 'review',
      fields: [{ name: 'note', type: 'text' }],
      access: { read: namedAs('adminOnlyField', () => true) },
    }
    const { rows, problems } = auditAccess({
      collections: [{ slug: 'probe', access: {}, fields: [{ type: 'tabs', tabs: [tab] }] }],
      globals: [],
    } as unknown as SanitizedConfig)
    expect(problems.filter((problem) => problem.startsWith('collection:probe'))).toEqual([])
    expect(rows.find((row) => row.field === 'review')?.rules.read).toBe('adminOnlyField')
    expect(rows.find((row) => row.field === 'review.note')?.rules.read).toBe('open')
  })

  it('fails on a rule named after another operation', () => {
    expect(probe({ name: 'value', access: { update: namedAs('read', () => true) } })).toEqual([
      'collection:probe value update: unnamed rule',
    ])
    expect(probe({ name: 'value', access: { read: namedAs('readVersions', () => true) } })).toEqual(
      ['collection:probe value read: unnamed rule'],
    )
  })

  it('lists the plugin rules of the OAuth collections', () => {
    const labels = UPSTREAM.filter((entry) => entry.entity.startsWith('collection:oauth-')).map(
      (entry) => entry.label,
    )
    expect(new Set(labels)).toEqual(new Set(['plugin:mcp-oauth:denyPublic']))
    expect(labels).toHaveLength(10)
  })

  it('src sets no rule that Payload or a plugin adds later', () => {
    expect(sourceConfig.collections?.length).toBeGreaterThan(30)
    expect(srcOverlapsUpstream(sourceConfig)).toEqual([])
  })

  it('the API key override sets no rule on a field that UPSTREAM lists', () => {
    const fields = ['user', 'apiKey', 'apiKeyIndex'].map((name) => ({ name, type: 'text' }))
    const overridden = overrideApiKeyCollection({
      slug: 'payload-mcp-api-keys',
      fields,
    } as unknown as CollectionConfig)
    expect(srcOverlapsUpstream({ collections: [overridden] })).toEqual([])
  })
})
