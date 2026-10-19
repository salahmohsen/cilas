import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_thematic" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_labs" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_workshops" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_short" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_bridge" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_fellows" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_cilasians" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_governance" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_articles" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "navigation_calendar" boolean DEFAULT true;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" DROP COLUMN "navigation_thematic";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_labs";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_workshops";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_short";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_bridge";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_fellows";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_cilasians";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_governance";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_articles";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_calendar";`)
}
