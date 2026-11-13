import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_site_settings_hero_scene" AS ENUM('felucca', 'crowd');
  ALTER TABLE "site_settings" ADD COLUMN "hero_scene" "enum_site_settings_hero_scene" DEFAULT 'felucca' NOT NULL;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "hero_scene";
  DROP TYPE "public"."enum_site_settings_hero_scene";`)
}
