import { getPayload } from 'payload'
const { default: config } = await import('../../src/payload.config')
const payload = await getPayload({ config: await config })
for (const collection of Object.keys(payload.collections)) {
  if (collection.startsWith('payload-')) continue
  try {
    const r = await payload.find({
      collection: collection as any,
      sort: '-updatedAt',
      limit: 8,
      depth: 0,
      draft: true,
      overrideAccess: true,
    })
    console.log(
      collection,
      r.totalDocs,
      r.docs.map((d: any) => `${d.id}@${String(d.updatedAt).slice(0, 16)}`).join(' '),
    )
  } catch (e: any) {
    console.log(collection, 'ERR', e.message.slice(0, 80))
  }
}
for (const g of payload.config.globals) {
  const r: any = await payload.findGlobal({ slug: g.slug as any, depth: 0 })
  console.log('global', g.slug, r.updatedAt)
}
await payload.destroy()
process.exit(0)
