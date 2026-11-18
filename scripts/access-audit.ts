import type { Block, Field, SanitizedConfig } from 'payload'
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
 * comes first.
 *
 * Regenerate the committed snapshot with `pnpm audit:access`.
 */

const FIELD_OPERATIONS = ['create', 'read', 'update'] as const
const ENTITY_OPERATIONS = [
  'admin',
  'create',
  'read',
  'readDrafts',
  'readVersions',
  'update',
  'delete',
  'unlock',
]

type Rule = (...args: never[]) => unknown
type Rules = Record<string, unknown> | undefined
type Entry = { path: string; access: Rules }
type Upstream = { entity: string; field: string; operation: string; label: string; source: string }

export type AccessRow = { entity: string; field: string; rules: Record<string, string> }

const CLOSED = '()=>false'

const closed = (entity: string, field: string, operations: string[], label: string): Upstream[] =>
  operations.map((operation) => ({ entity, field, operation, label, source: CLOSED }))

/**
 * Rules that Payload or a plugin adds while it sanitizes the config, after
 * src/ has run, so src/ cannot name them. Each entry holds the rule's source
 * without whitespace: an upgrade that changes the rule fails the audit.
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
]

const sourceOf = (rule: Rule) => rule.toString().replace(/\s+/g, '')

const isNamed = (rule: Rule, operation: string) =>
  rule.name !== '' && rule.name !== operation && !/\banonymous\b/.test(rule.name)

const blocksOf = (references: (Block | string)[], config: SanitizedConfig) =>
  references.flatMap((reference) => {
    if (typeof reference !== 'string') return [reference]
    const block = config.blocks?.find(({ slug }) => slug === reference)
    return block ? [block] : []
  })

const entries = (fields: Field[], prefix: string, config: SanitizedConfig): Entry[] =>
  fields.flatMap((field): Entry[] => {
    if (field.type === 'tabs')
      return field.tabs.flatMap((tab) =>
        tabHasName(tab)
          ? [
              { path: `${prefix}${tab.name}`, access: (tab as { access?: Rules }).access },
              ...entries(tab.fields, `${prefix}${tab.name}.`, config),
            ]
          : entries(tab.fields, prefix, config),
      )
    if (field.type === 'row' || field.type === 'collapsible')
      return entries(field.fields, prefix, config)
    if (field.type === 'group' && !('name' in field && field.name))
      return entries(field.fields, prefix, config)
    if (!fieldAffectsData(field)) return []
    const self: Entry = { path: `${prefix}${field.name}`, access: field.access as Rules }
    if (field.type === 'group' || field.type === 'array')
      return [self, ...entries(field.fields, `${self.path}.`, config)]
    if (field.type === 'blocks')
      return [
        self,
        ...blocksOf(field.blockReferences ?? field.blocks, config).flatMap((block) =>
          entries(block.fields, `${self.path}.${block.slug}.`, config),
        ),
      ]
    return [self]
  })

/**
 * The paths of the fields in `fields` whose own access holds a function. The
 * test of UPSTREAM runs it on what src/ defines, so that a rule from src/ does
 * not pass as a rule that Payload added.
 */
export const sourceSetsAccess = (fields: Field[]) =>
  entries(fields, '', { blocks: [] } as unknown as SanitizedConfig)
    .filter(({ access }) => Object.values(access ?? {}).some((rule) => typeof rule === 'function'))
    .map(({ path }) => path)

export const auditAccess = (config: SanitizedConfig) => {
  const rows: AccessRow[] = []
  const problems: string[] = []
  const upstream = new Map(
    UPSTREAM.map((entry) => [`${entry.entity} ${entry.field} ${entry.operation}`, entry]),
  )
  const met = new Set<string>()
  const names = new Map<string, { source: string; where: string; rules: Set<Rule> }>()

  const label = (entity: string, field: string, operation: string, value: unknown) => {
    if (typeof value !== 'function') return 'open'
    const rule = value as Rule
    const where = `${entity} ${field} ${operation}`
    const known = upstream.get(where)
    if (known) {
      met.add(where)
      if (known.source !== sourceOf(rule) || isNamed(rule, operation))
        problems.push(`${where}: the rule no longer matches UPSTREAM`)
      return known.label
    }
    if (!isNamed(rule, operation)) {
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
    return rule.name
  }

  const audit = (entity: string, access: Rules, fields: Field[]) => {
    const operations = [
      ...ENTITY_OPERATIONS,
      ...Object.keys(access ?? {})
        .filter((operation) => !ENTITY_OPERATIONS.includes(operation))
        .sort(),
    ].filter((operation) => typeof access?.[operation] === 'function')
    rows.push({
      entity,
      field: '*',
      rules: Object.fromEntries(
        operations.map((operation) => [
          operation,
          label(entity, '*', operation, access?.[operation]),
        ]),
      ),
    })
    for (const { path, access: own } of entries(fields, '', config))
      rows.push({
        entity,
        field: path,
        rules: Object.fromEntries(
          FIELD_OPERATIONS.map((operation) => [
            operation,
            label(entity, path, operation, own?.[operation]),
          ]),
        ),
      })
  }

  for (const collection of config.collections)
    audit(`collection:${collection.slug}`, collection.access as Rules, collection.fields)
  for (const global of config.globals)
    audit(`global:${global.slug}`, global.access as Rules, global.fields)
  for (const where of upstream.keys())
    if (!met.has(where)) problems.push(`${where}: no such rule; remove it from UPSTREAM`)

  return { rows, problems }
}
