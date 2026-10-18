import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// Press left SEO_COLLECTIONS on purpose (569bf16), but no migration removed its
// SEO columns, and 20261018_042322_publication_drafts kept them because they
// still held data. This removes them. The schema snapshot is unchanged.
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "press_locales" DROP CONSTRAINT IF EXISTS "press_locales_meta_image_id_media_id_fk";
  DROP INDEX IF EXISTS "press_meta_meta_image_idx";
  ALTER TABLE "press_locales" DROP COLUMN IF EXISTS "meta_title";
  ALTER TABLE "press_locales" DROP COLUMN IF EXISTS "meta_description";
  ALTER TABLE "press_locales" DROP COLUMN IF EXISTS "meta_image_id";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "press_locales" ADD COLUMN "meta_title" varchar;
  ALTER TABLE "press_locales" ADD COLUMN "meta_description" varchar;
  ALTER TABLE "press_locales" ADD COLUMN "meta_image_id" integer;
  ALTER TABLE "press_locales" ADD CONSTRAINT "press_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "press_meta_meta_image_idx" ON "press_locales" USING btree ("meta_image_id","_locale");`)
}
