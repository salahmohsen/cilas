import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" ADD COLUMN "event_place" varchar;
  ALTER TABLE "space_posts" ADD COLUMN "event_cover_id" integer;
  ALTER TABLE "space_posts" ADD COLUMN "event_cover_tone" varchar;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_place" varchar;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_cover_id" integer;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_cover_tone" varchar;
  ALTER TABLE "space_posts" ADD CONSTRAINT "space_posts_event_cover_id_space_files_id_fk" FOREIGN KEY ("event_cover_id") REFERENCES "public"."space_files"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_posts_v" ADD CONSTRAINT "_space_posts_v_version_event_cover_id_space_files_id_fk" FOREIGN KEY ("version_event_cover_id") REFERENCES "public"."space_files"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_posts_event_cover_idx" ON "space_posts" USING btree ("event_cover_id");
  CREATE INDEX "_space_posts_v_version_version_event_cover_idx" ON "_space_posts_v" USING btree ("version_event_cover_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" DROP CONSTRAINT "space_posts_event_cover_id_space_files_id_fk";
  
  ALTER TABLE "_space_posts_v" DROP CONSTRAINT "_space_posts_v_version_event_cover_id_space_files_id_fk";
  
  DROP INDEX "space_posts_event_cover_idx";
  DROP INDEX "_space_posts_v_version_version_event_cover_idx";
  ALTER TABLE "space_posts" DROP COLUMN "event_place";
  ALTER TABLE "space_posts" DROP COLUMN "event_cover_id";
  ALTER TABLE "space_posts" DROP COLUMN "event_cover_tone";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_place";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_cover_id";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_cover_tone";`)
}
