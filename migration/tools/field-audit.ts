/** Lists every field: docs holding a value, and whether the frontend reads it. */
import { execSync } from 'node:child_process'
import { getPayload, type Field } from 'payload'

const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
const skip = new Set([
  'payload-preferences',
  'payload-migrations',
  'payload-locked-documents',
  'payload-kv',
  'payload-jobs',
])

const walk = (
  fields: Field[],
  prefix = '',
): Array<{ path: string; type: string; name: string; desc: boolean; label: string }> =>
  fields.flatMap((f) => {
    const any = f as unknown as {
      name?: string
      type: string
      fields?: Field[]
      tabs?: Array<{ fields: Field[]; name?: string }>
      admin?: { description?: unknown; hidden?: boolean }
      label?: unknown
    }
    if (any.type === 'tabs')
      return (any.tabs ?? []).flatMap((t) =>
        walk(t.fields, t.name ? `${prefix}${t.name}.` : prefix),
      )
    if (!any.name) return any.fields ? walk(any.fields, prefix) : []
    const path = `${prefix}${any.name}`
    const self = any.admin?.hidden
      ? []
      : [
          {
            path,
            type: any.type,
            name: any.name,
            desc: Boolean(any.admin?.description),
            label: typeof any.label === 'string' ? any.label : '',
          },
        ]
    if (any.type === 'group' || any.type === 'array')
      return [...self, ...walk(any.fields ?? [], `${path}.`)]
    if (any.type === 'blocks') return self
    return self
  })

const used = (name: string) => {
  try {
    return Number(
      execSync(
        `grep -rlw --include=*.ts --include=*.tsx "${name}" src/app src/components src/api src/lib | wc -l`,
        { encoding: 'utf8' },
      ).trim(),
    )
  } catch {
    return 0
  }
}

const rows: string[] = []
for (const c of payload.config.collections) {
  if (skip.has(c.slug)) continue
  const total = (await payload.count({ collection: c.slug, overrideAccess: true })).totalDocs
  for (const f of walk(c.fields)) {
    if (['id', 'createdAt', 'updatedAt'].includes(f.name)) continue
    let filled: number | string = '?'
    try {
      filled = (
        await payload.count({
          collection: c.slug,
          where: { [f.path]: { exists: true } },
          overrideAccess: true,
        })
      ).totalDocs
    } catch {}
    rows.push(
      [c.slug, f.path, f.type, `${filled}/${total}`, used(f.name), f.desc ? 'desc' : ''].join('\t'),
    )
  }
}
for (const g of payload.config.globals)
  for (const f of walk(g.fields))
    rows.push(
      [`global:${g.slug}`, f.path, f.type, '-', used(f.name), f.desc ? 'desc' : ''].join('\t'),
    )
console.log(['collection', 'field', 'type', 'filled', 'src files', 'has desc'].join('\t'))
console.log(rows.join('\n'))
await payload.destroy()
process.exit(0)
