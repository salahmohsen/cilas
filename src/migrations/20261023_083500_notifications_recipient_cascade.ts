import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * A notification is of no one without its recipient: the account's delete
 * clears its bell. The old SET NULL could never work — the recipient is
 * required, so the delete of a notified account failed outright.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_recipient_id_users_id_fk";
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk"
      FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "notifications" DROP CONSTRAINT IF EXISTS "notifications_recipient_id_users_id_fk";
    ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_users_id_fk"
      FOREIGN KEY ("recipient_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;`)
}
