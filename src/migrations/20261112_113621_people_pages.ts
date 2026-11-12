import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" RENAME COLUMN "navigation_fellows" TO "people_pages_fellows";
  ALTER TABLE "site_settings" RENAME COLUMN "navigation_cilasians" TO "people_pages_cilasians";
  ALTER TABLE "site_settings" RENAME COLUMN "navigation_governance" TO "people_pages_governance";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_thematic";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_labs";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_workshops";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_short";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_bridge";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_articles";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_events";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_calendar";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "site_settings" ADD COLUMN "navigation_thematic" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_labs" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_workshops" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_short" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_bridge" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_articles" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_events" boolean DEFAULT true;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_calendar" boolean DEFAULT true;
  ALTER TABLE "site_settings" RENAME COLUMN "people_pages_fellows" TO "navigation_fellows";
  ALTER TABLE "site_settings" RENAME COLUMN "people_pages_cilasians" TO "navigation_cilasians";
  ALTER TABLE "site_settings" RENAME COLUMN "people_pages_governance" TO "navigation_governance";`)
}
