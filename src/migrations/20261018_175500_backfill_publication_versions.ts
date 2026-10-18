import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Publications gained drafts (20261018_042322_publication_drafts) after two
 * were imported, and that migration made no version for them. With drafts,
 * the admin list reads the versions, so those two never showed there. Saving
 * each once through Payload writes its missing version; nothing else changes.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute(sql`
    SELECT p.id FROM publications p
    WHERE NOT EXISTS (SELECT 1 FROM _publications_v v WHERE v.parent_id = p.id)`)
  for (const { id } of rows as Array<{ id: number }>) {
    const doc = await payload.findByID({ collection: 'publications', id, depth: 0, req, overrideAccess: true })
    await payload.update({
      collection: 'publications',
      id,
      data: { _status: doc._status ?? 'published' },
      req,
      overrideAccess: true,
    })
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // The versions it wrote are ordinary history; nothing to undo.
}
