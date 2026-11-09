import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_sessions_delivery" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  CREATE TYPE "public"."enum__courses_v_version_sessions_delivery" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  ALTER TABLE "courses_sessions" ADD COLUMN "delivery" "enum_courses_sessions_delivery";
  ALTER TABLE "_courses_v_version_sessions" ADD COLUMN "delivery" "enum__courses_v_version_sessions_delivery";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_sessions" DROP COLUMN "delivery";
  ALTER TABLE "_courses_v_version_sessions" DROP COLUMN "delivery";
  DROP TYPE "public"."enum_courses_sessions_delivery";
  DROP TYPE "public"."enum__courses_v_version_sessions_delivery";`)
}
