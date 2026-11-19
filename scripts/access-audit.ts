import { createHash } from 'node:crypto'

import type { Block, Field } from 'payload'
import { fieldAffectsData, tabHasName } from 'payload/shared'

/**
 * The access audit (docs/superpowers/specs/2026-11-18-portal-design.md,
 * "Security baseline"). One row per collection, global and data field, with
 * the name of each access rule. No rule is called: many depend on the
 * document. The naming guide is in AGENTS.md.
 *
 * A field with no rule for an operation prints `open`: the rule of its
 * collection decides. A rule on a group or array covers its subtree in
 * Payload; each row shows only the field's own rule, and the parent row
 * comes first. A collection or global operation is never `open`: a missing
 * rule means Payload's logged-in default (`payload:loggedIn`).
 *
 * A row names a rule as `name#hash`. The hash is the first 8 hex digits of the
 * sha256 of the rule's source without whitespace, so a rule that keeps its name
 * and changes its body changes its row. A factory's closure has the same source
 * in every call; its name carries the arguments, so name and hash together
 * identify the rule. The implicit `payload:loggedIn` and `payload:defaultUnlock`
 * rules have no hash: the audit already pins their source.
 *
 * Regenerate the committed snapshot with `pnpm audit:access`.
 *
 * The audit does not cover:
 * - custom endpoints (they check access themselves, or do not);
 * - reads with `overrideAccess: true` (they skip every rule listed here);
 * - hooks that rewrite data after an access rule has run;
 * - fields inside Lexical `BlocksFeature` blocks (they are not config fields).
 */

const FIELD_OPERATIONS = ['create', 'read', 'update'] as const
const ENTITY_OPERATIONS = ['admin', 'create', 'read', 'readVersions', 'update', 'delete', 'unlock']

type Rule = (...args: never[]) => unknown
type Rules = Record<string, unknown> | undefined
type Entry = { path: string; access: Rules }
type Upstream = {
  entity: string
  field: string
  operation: string
  label: string
  source: string
  /** The name a plugin's bundler gave the rule. Without it, the rule has no name. */
  name?: RegExp
}
type EntityConfig = {
  slug: string
  access?: Rules
  fields: Field[]
  auth?: unknown
  versions?: unknown
}
type Entities = { collections?: EntityConfig[]; globals?: EntityConfig[]; blocks?: Block[] }

export type AccessRow = { entity: string; field: string; rules: Record<string, string> }

const CLOSED = '()=>false'

const closed = (
  entity: string,
  field: string,
  operations: string[],
  label: string,
  name?: RegExp,
): Upstream[] =>
  operations.map((operation) => ({ entity, field, operation, label, source: CLOSED, name }))

const OAUTH_LABEL = 'plugin:mcp-oauth:denyPublic'
const OAUTH_NAME = /^denyPublicAccess\d*$/
const oauthClosed = (slug: string, operations: string[]) =>
  closed(`collection:oauth-${slug}`, '*', operations, OAUTH_LABEL, OAUTH_NAME)
const ALL_OPERATIONS = ['create', 'read', 'update', 'delete']

/**
 * Rules that Payload or a plugin adds while it sanitizes the config, after
 * src/ has run, so src/ cannot name them. Each entry holds the rule's source
 * without whitespace: an upgrade that changes the rule fails the audit. A rule
 * has no name, unless the entry gives the pattern of the name that a plugin's
 * bundler chose.
 */
export const UPSTREAM: Upstream[] = [
  ...[
    'resetPasswordToken',
    'resetPasswordExpiration',
    'salt',
    'hash',
    'resetPasswordRequestedAt',
    'loginAttempts',
    'lockUntil',
  ].flatMap((field) => closed('collection:users', field, ['create', 'update'], 'payload:auth')),
  ...closed('collection:users', 'sessions', ['update'], 'payload:auth'),
  {
    entity: 'collection:users',
    field: 'sessions',
    operation: 'read',
    label: 'payload:ownSessions',
    source: '({doc,req:{user}})=>{returnuser?.id===doc?.id;}',
  },
  ...closed('collection:payload-mcp-api-keys', 'user', ['create', 'update'], 'plugin-mcp:keyOwner'),
  ...closed('collection:payload-mcp-api-keys', 'apiKey', ['read'], 'payload:apiKey'),
  ...closed('collection:payload-mcp-api-keys', 'apiKeyIndex', ['read'], 'payload:apiKey'),
  ...closed(
    'collection:payload-kv',
    '*',
    ['create', 'read', 'update', 'delete'],
    'payload:internal',
  ),
  ...closed(
    'collection:payload-jobs',
    '*',
    ['create', 'read', 'update', 'delete'],
    'payload:internal',
  ),
  ...oauthClosed('auth-codes', ALL_OPERATIONS),
  ...oauthClosed('csrf-nonces', ALL_OPERATIONS),
  ...oauthClosed('clients', ['create']),
  ...oauthClosed('tokens', ['create']),
]

/**
 * The rules that Payload puts on a collection or global that has none. Payload
 * does not export them, so each entry holds the source without whitespace.
 */
const PAYLOAD_DEFAULTS = [
  {
    label: 'payload:loggedIn',
    name: 'defaultAccess',
    source: '({req:{user}})=>Boolean(user)',
  },
  {
    label: 'payload:defaultUnlock',
    name: 'defaultUnlockAccess',
    source:
      '({req:{payload,user}})=>{if(!user){returnfalse;}returnuser.collection===payload.config.admin.user;}',
  },
]

const sourceOf = (rule: Rule) => rule.toString().replace(/\s+/g, '')

const HASH_LENGTH = 8
const hashOf = (rule: Rule) =>
  createHash('sha256').update(sourceOf(rule)).digest('hex').slice(0, HASH_LENGTH)
const hashed = (label: string, rule: Rule) => `${label}#${hashOf(rule)}`

/** The readable label of a row value: the name without its `#hash`. */
export const withoutHash = (label: string) =>
  label.replace(new RegExp(`#[0-9a-f]{${HASH_LENGTH}}$`), '')

const isNamed = (rule: Rule) =>
  rule.name !== '' && !ENTITY_OPERATIONS.includes(rule.name) && !/\banonymous\b/.test(rule.name)

type BlockOf = (slug: string) => Block | undefined

const blocksOf = (references: (Block | string)[], blockOf: BlockOf) =>
  references.flatMap((reference) => {
    const block = typeof reference === 'string' ? blockOf(reference) : reference
    return block ? [block] : []
  })

const entries = (fields: Field[], prefix: string, blockOf: BlockOf): Entry[] =>
  fields.flatMap((field): Entry[] => {
    if (field.type === 'tabs')
      return field.tabs.flatMap((tab) =>
        tabHasName(tab)
          ? [
              { path: `${prefix}${tab.name}`, access: tab.access },
              ...entries(tab.fields, `${prefix}${tab.name}.`, blockOf),
            ]
          : entries(tab.fields, prefix, blockOf),
      )
    if (field.type === 'row' || field.type === 'collapsible')
      return entries(field.fields, prefix, blockOf)
    if (field.type === 'group' && !('name' in field && field.name))
      return entries(field.fields, prefix, blockOf)
    if (!fieldAffectsData(field)) return []
    const self: Entry = { path: `${prefix}${field.name}`, access: field.access as Rules }
    if (field.type === 'group' || field.type === 'array')
      return [self, ...entries(field.fields, `${self.path}.`, blockOf)]
    if (field.type === 'blocks')
      return [
        self,
        ...blocksOf(field.blockReferences ?? field.blocks, blockOf).flatMap((block) =>
          entries(block.fields, `${self.path}.${block.slug}.`, blockOf),
        ),
      ]
    return [self]
  })

const NO_BLOCKS: BlockOf = () => undefined

const entitiesOf = ({ collections = [], globals = [] }: Entities) => [
  ...collections.map((entity) => ({ ...entity, id: `collection:${entity.slug}` })),
  ...globals.map((entity) => ({ ...entity, id: `global:${entity.slug}` })),
]

/**
 * The UPSTREAM rules that `config` (as src/ writes it, before any plugin or
 * Payload sanitizes it) already sets itself. A rule from src/ must not pass as
 * a rule that Payload added, so the audit test requires that this is empty.
 */
export const srcOverlapsUpstream = (config: Entities) =>
  entitiesOf(config).flatMap(({ id, access, fields }) => {
    const own = new Map(entries(fields, '', NO_BLOCKS).map((entry) => [entry.path, entry.access]))
    return UPSTREAM.filter(
      (rule) =>
        rule.entity === id &&
        typeof (rule.field === '*' ? access : own.get(rule.field))?.[rule.operation] === 'function',
    ).map((rule) => `${id} ${rule.field} ${rule.operation}`)
  })

export const auditAccess = (config: Entities) => {
  const rows: AccessRow[] = []
  const problems: string[] = []
  const upstream = new Map(
    UPSTREAM.map((rule) => [`${rule.entity} ${rule.field} ${rule.operation}`, rule]),
  )
  const met = new Set<string>()
  const names = new Map<string, { source: string; where: string; rules: Set<Rule> }>()
  const blockOf: BlockOf = (slug) => config.blocks?.find((block) => block.slug === slug)

  const label = (entity: string, field: string, operation: string, value: unknown) => {
    if (typeof value !== 'function') return 'open'
    const rule = value as Rule
    const where = `${entity} ${field} ${operation}`
    const known = upstream.get(where)
    if (known) {
      met.add(where)
      if (known.source !== sourceOf(rule) || !(known.name?.test(rule.name) ?? !isNamed(rule)))
        problems.push(`${where}: the rule no longer matches UPSTREAM`)
      return hashed(known.label, rule)
    }
    const payloadDefault = PAYLOAD_DEFAULTS.find(
      ({ name, source }) => rule.name === name && source === sourceOf(rule),
    )
    if (payloadDefault) return payloadDefault.label
    if (!isNamed(rule)) {
      problems.push(`${where}: unnamed rule`)
      return 'unnamed'
    }
    const seen = names.get(rule.name)
    if (!seen) {
      names.set(rule.name, { source: sourceOf(rule), where, rules: new Set([rule]) })
    } else if (seen.source !== sourceOf(rule)) {
      problems.push(`${where}: ${rule.name} also names a different rule at ${seen.where}`)
    } else if (!rule.name.includes('(') && !seen.rules.has(rule)) {
      problems.push(`${where}: ${rule.name} names two functions; a factory must name its rules`)
    }
    seen?.rules.add(rule)
    return hashed(rule.name, rule)
  }

  const audit = ({ id, access, fields, auth, versions }: ReturnType<typeof entitiesOf>[number]) => {
    const resolvedWithoutRule = (operation: string) =>
      (operation === 'admin' && Boolean(auth)) ||
      (operation === 'readVersions' && Boolean(versions))
    const operations = [
      ...ENTITY_OPERATIONS,
      ...Object.keys(access ?? {})
        .filter((operation) => !ENTITY_OPERATIONS.includes(operation))
        .sort(),
    ].filter(
      (operation) => typeof access?.[operation] === 'function' || resolvedWithoutRule(operation),
    )
    rows.push({
      entity: id,
      field: '*',
      rules: Object.fromEntries(
        operations.map((operation) => [
          operation,
          access?.[operation] ? label(id, '*', operation, access[operation]) : 'payload:loggedIn',
        ]),
      ),
    })
    for (const { path, access: own } of entries(fields, '', blockOf))
      rows.push({
        entity: id,
        field: path,
        rules: Object.fromEntries(
          FIELD_OPERATIONS.map((operation) => [
            operation,
            label(id, path, operation, own?.[operation]),
          ]),
        ),
      })
  }

  entitiesOf(config).forEach(audit)
  for (const where of upstream.keys())
    if (!met.has(where)) problems.push(`${where}: no such rule; remove it from UPSTREAM`)

  return { rows, problems }
}
