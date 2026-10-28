import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events" ADD COLUMN "cover_image_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "navigation_events" boolean DEFAULT true;
  ALTER TABLE "events" ADD CONSTRAINT "events_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_cover_image_idx" ON "events" USING btree ("cover_image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events" DROP CONSTRAINT "events_cover_image_id_media_id_fk";

  DROP INDEX "events_cover_image_idx";
  ALTER TABLE "events" DROP COLUMN "cover_image_id";
  ALTER TABLE "site_settings" DROP COLUMN "navigation_events";`)
}
