import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_site_settings_social_links_platform" RENAME VALUE 'twitter' TO 'x';
   ALTER TYPE "public"."enum_site_settings_social_links_platform" ADD VALUE 'linkedin';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "site_settings_social_links" SET "platform" = NULL WHERE "platform" = 'linkedin';
  ALTER TABLE "site_settings_social_links" ALTER COLUMN "platform" SET DATA TYPE text;
  UPDATE "site_settings_social_links" SET "platform" = 'twitter' WHERE "platform" = 'x';
  DROP TYPE "public"."enum_site_settings_social_links_platform";
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('facebook', 'twitter', 'youtube', 'instagram');
  ALTER TABLE "site_settings_social_links" ALTER COLUMN "platform" SET DATA TYPE "public"."enum_site_settings_social_links_platform" USING "platform"::"public"."enum_site_settings_social_links_platform";`)
}
