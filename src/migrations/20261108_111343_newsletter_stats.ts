import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters" ADD COLUMN "stats" jsonb;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_stats" jsonb;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters" DROP COLUMN "stats";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_stats";`)
}
