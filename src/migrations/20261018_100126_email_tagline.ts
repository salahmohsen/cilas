import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings" ADD COLUMN "tagline" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_newsletter_in_this_issue" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "email_settings" DROP COLUMN "tagline";
  ALTER TABLE "email_settings" DROP COLUMN "texts_newsletter_in_this_issue";`)
}
