import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces" ADD COLUMN "ai_buttons" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "ai_buttons" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces" DROP COLUMN "ai_buttons";
  ALTER TABLE "site_settings" DROP COLUMN "ai_buttons";`)
}
