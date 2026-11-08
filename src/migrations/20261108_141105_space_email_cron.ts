import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_space_preferences_locale" AS ENUM('en', 'ar');
  ALTER TABLE "space_preferences" ALTER COLUMN "digest" SET DEFAULT 'weekly';
  ALTER TABLE "space_preferences" ADD COLUMN "stop_all_email" boolean DEFAULT false;
  ALTER TABLE "space_preferences" ADD COLUMN "locale" "enum_space_preferences_locale";
  ALTER TABLE "space_preferences" ADD COLUMN "digest_sent_at" timestamp(3) with time zone;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_preferences" ALTER COLUMN "digest" SET DEFAULT 'daily';
  ALTER TABLE "space_preferences" DROP COLUMN "stop_all_email";
  ALTER TABLE "space_preferences" DROP COLUMN "locale";
  ALTER TABLE "space_preferences" DROP COLUMN "digest_sent_at";
  DROP TYPE "public"."enum_space_preferences_locale";`)
}
