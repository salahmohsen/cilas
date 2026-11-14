import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP COLUMN "session_unit";
  ALTER TABLE "courses" DROP COLUMN "announced_start_day";
  ALTER TABLE "courses" DROP COLUMN "announced_weeks";
  ALTER TABLE "courses_locales" DROP COLUMN "summary";
  ALTER TABLE "courses_locales" DROP COLUMN "timing_note";
  ALTER TABLE "_courses_v" DROP COLUMN "version_session_unit";
  ALTER TABLE "_courses_v" DROP COLUMN "version_announced_start_day";
  ALTER TABLE "_courses_v" DROP COLUMN "version_announced_weeks";
  ALTER TABLE "_courses_v_locales" DROP COLUMN "version_summary";
  ALTER TABLE "_courses_v_locales" DROP COLUMN "version_timing_note";
  DROP TYPE "public"."enum_courses_session_unit";
  DROP TYPE "public"."enum__courses_v_version_session_unit";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_session_unit" AS ENUM('session', 'week');
  CREATE TYPE "public"."enum__courses_v_version_session_unit" AS ENUM('session', 'week');
  ALTER TABLE "courses" ADD COLUMN "session_unit" "enum_courses_session_unit" DEFAULT 'session';
  ALTER TABLE "courses" ADD COLUMN "announced_start_day" varchar;
  ALTER TABLE "courses" ADD COLUMN "announced_weeks" numeric;
  ALTER TABLE "courses_locales" ADD COLUMN "summary" varchar;
  ALTER TABLE "courses_locales" ADD COLUMN "timing_note" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_session_unit" "enum__courses_v_version_session_unit" DEFAULT 'session';
  ALTER TABLE "_courses_v" ADD COLUMN "version_announced_start_day" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_announced_weeks" numeric;
  ALTER TABLE "_courses_v_locales" ADD COLUMN "version_summary" varchar;
  ALTER TABLE "_courses_v_locales" ADD COLUMN "version_timing_note" varchar;`)
}
