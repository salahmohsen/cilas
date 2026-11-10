import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_registration_mode" AS ENUM('follow_cycle', 'own', 'closed');
  CREATE TYPE "public"."enum__courses_v_version_registration_mode" AS ENUM('follow_cycle', 'own', 'closed');
  ALTER TABLE "courses" ADD COLUMN "registration_mode" "enum_courses_registration_mode" DEFAULT 'follow_cycle';
  ALTER TABLE "courses" ADD COLUMN "registration_close_early" timestamp(3) with time zone;
  ALTER TABLE "_courses_v" ADD COLUMN "version_registration_mode" "enum__courses_v_version_registration_mode" DEFAULT 'follow_cycle';
  ALTER TABLE "_courses_v" ADD COLUMN "version_registration_close_early" timestamp(3) with time zone;
  UPDATE "courses" SET "registration_mode" = (CASE WHEN "registration_method"::text IN ('form', 'external') THEN 'own' WHEN "registration_method"::text = 'closed' THEN 'closed' ELSE 'follow_cycle' END)::"enum_courses_registration_mode";
  UPDATE "_courses_v" SET "version_registration_mode" = (CASE WHEN "version_registration_method"::text IN ('form', 'external') THEN 'own' WHEN "version_registration_method"::text = 'closed' THEN 'closed' ELSE 'follow_cycle' END)::"enum__courses_v_version_registration_mode";
  ALTER TABLE "courses" ALTER COLUMN "cycle_id" DROP NOT NULL;
  ALTER TABLE "_courses_v" ALTER COLUMN "version_cycle_id" DROP NOT NULL;
  ALTER TABLE "courses" ALTER COLUMN "registration_method" SET DATA TYPE text;
  UPDATE "courses" SET "registration_method" = NULL WHERE "registration_method" = 'closed';
  DROP TYPE "public"."enum_courses_registration_method";
  CREATE TYPE "public"."enum_courses_registration_method" AS ENUM('form', 'external');
  ALTER TABLE "courses" ALTER COLUMN "registration_method" SET DATA TYPE "public"."enum_courses_registration_method" USING "registration_method"::"public"."enum_courses_registration_method";
  ALTER TABLE "_courses_v" ALTER COLUMN "version_registration_method" SET DATA TYPE text;
  UPDATE "_courses_v" SET "version_registration_method" = NULL WHERE "version_registration_method" = 'closed';
  DROP TYPE "public"."enum__courses_v_version_registration_method";
  CREATE TYPE "public"."enum__courses_v_version_registration_method" AS ENUM('form', 'external');
  ALTER TABLE "_courses_v" ALTER COLUMN "version_registration_method" SET DATA TYPE "public"."enum__courses_v_version_registration_method" USING "version_registration_method"::"public"."enum__courses_v_version_registration_method";
  ALTER TABLE "courses" DROP COLUMN "registration_archived_registration_url";
  ALTER TABLE "_courses_v" DROP COLUMN "version_registration_archived_registration_url";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" ALTER COLUMN "registration_method" SET DATA TYPE text;
  DROP TYPE "public"."enum_courses_registration_method";
  CREATE TYPE "public"."enum_courses_registration_method" AS ENUM('form', 'external', 'closed');
  UPDATE "courses" SET "registration_method" = CASE WHEN "registration_mode" = 'closed' THEN 'closed' WHEN "registration_mode" = 'follow_cycle' THEN NULL ELSE "registration_method" END;
  ALTER TABLE "courses" ALTER COLUMN "registration_method" SET DATA TYPE "public"."enum_courses_registration_method" USING "registration_method"::"public"."enum_courses_registration_method";
  ALTER TABLE "_courses_v" ALTER COLUMN "version_registration_method" SET DATA TYPE text;
  DROP TYPE "public"."enum__courses_v_version_registration_method";
  CREATE TYPE "public"."enum__courses_v_version_registration_method" AS ENUM('form', 'external', 'closed');
  UPDATE "_courses_v" SET "version_registration_method" = CASE WHEN "version_registration_mode" = 'closed' THEN 'closed' WHEN "version_registration_mode" = 'follow_cycle' THEN NULL ELSE "version_registration_method" END;
  ALTER TABLE "_courses_v" ALTER COLUMN "version_registration_method" SET DATA TYPE "public"."enum__courses_v_version_registration_method" USING "version_registration_method"::"public"."enum__courses_v_version_registration_method";
  ALTER TABLE "courses" ADD COLUMN "registration_archived_registration_url" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_registration_archived_registration_url" varchar;
  ALTER TABLE "courses" DROP COLUMN "registration_mode";
  ALTER TABLE "courses" DROP COLUMN "registration_close_early";
  ALTER TABLE "_courses_v" DROP COLUMN "version_registration_mode";
  ALTER TABLE "_courses_v" DROP COLUMN "version_registration_close_early";
  DROP TYPE "public"."enum_courses_registration_mode";
  DROP TYPE "public"."enum__courses_v_version_registration_mode";`)
}
