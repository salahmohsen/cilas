import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" ADD COLUMN "announced_start_day" varchar;
  ALTER TABLE "courses" ADD COLUMN "announced_weeks" numeric;
  ALTER TABLE "_courses_v" ADD COLUMN "version_announced_start_day" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_announced_weeks" numeric;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP COLUMN "announced_start_day";
  ALTER TABLE "courses" DROP COLUMN "announced_weeks";
  ALTER TABLE "_courses_v" DROP COLUMN "version_announced_start_day";
  ALTER TABLE "_courses_v" DROP COLUMN "version_announced_weeks";`)
}
