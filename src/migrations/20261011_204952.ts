import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_media_import_status" AS ENUM('needs_review', 'reviewed');
  ALTER TABLE "media" ADD COLUMN "legacy_url" varchar;
  ALTER TABLE "media" ADD COLUMN "import_status" "enum_media_import_status";
  CREATE UNIQUE INDEX "media_legacy_url_idx" ON "media" USING btree ("legacy_url");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "media_legacy_url_idx";
  ALTER TABLE "media" DROP COLUMN "legacy_url";
  ALTER TABLE "media" DROP COLUMN "import_status";
  DROP TYPE "public"."enum_media_import_status";`)
}
