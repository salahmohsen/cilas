import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Every account but an admin's owns its work through a person. Accounts made
 * without one (a fellow added by hand, say) could not open a course they
 * proposed nor write an article. Saving each once through Payload runs
 * `ensurePerson` (src/collections/Users.ts), which gives it a hidden person
 * named from its email; the fellow role it has is kept.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  const { rows } = await db.execute(sql`
    SELECT u.id FROM users u
    WHERE u.person_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM users_roles r
        WHERE r.parent_id = u.id AND r.value IN ('admin', 'super_admin'))`)
  for (const { id } of rows as Array<{ id: number }>) {
    await payload.update({ collection: 'users', id, data: {}, req, overrideAccess: true })
  }
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // The hidden people it made are ordinary records an admin may keep or remove.
}
