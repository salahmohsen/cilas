import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_files" ADD COLUMN "space_id" integer NOT NULL;
  ALTER TABLE "space_files" ADD COLUMN "post_id" integer;
  ALTER TABLE "space_files" ADD COLUMN "comment_id" integer;
  ALTER TABLE "space_files" ADD COLUMN "prefix" varchar DEFAULT 'spaces';
  ALTER TABLE "space_files" ADD COLUMN "_objectkey" varchar;
  ALTER TABLE "space_files" ADD COLUMN "url" varchar;
  ALTER TABLE "space_files" ADD COLUMN "thumbnail_u_r_l" varchar;
  ALTER TABLE "space_files" ADD COLUMN "filename" varchar NOT NULL;
  ALTER TABLE "space_files" ADD COLUMN "mime_type" varchar;
  ALTER TABLE "space_files" ADD COLUMN "filesize" numeric;
  ALTER TABLE "space_files" ADD COLUMN "width" numeric;
  ALTER TABLE "space_files" ADD COLUMN "height" numeric;
  ALTER TABLE "space_files" ADD COLUMN "focal_x" numeric;
  ALTER TABLE "space_files" ADD COLUMN "focal_y" numeric;
  ALTER TABLE "space_files" ADD CONSTRAINT "space_files_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_files" ADD CONSTRAINT "space_files_post_id_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_files" ADD CONSTRAINT "space_files_comment_id_space_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."space_comments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_files_space_idx" ON "space_files" USING btree ("space_id");
  CREATE INDEX "space_files_post_idx" ON "space_files" USING btree ("post_id");
  CREATE INDEX "space_files_comment_idx" ON "space_files" USING btree ("comment_id");
  CREATE UNIQUE INDEX "space_files_filename_idx" ON "space_files" USING btree ("filename");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_files" DROP CONSTRAINT "space_files_space_id_spaces_id_fk";
  
  ALTER TABLE "space_files" DROP CONSTRAINT "space_files_post_id_space_posts_id_fk";
  
  ALTER TABLE "space_files" DROP CONSTRAINT "space_files_comment_id_space_comments_id_fk";
  
  DROP INDEX "space_files_space_idx";
  DROP INDEX "space_files_post_idx";
  DROP INDEX "space_files_comment_idx";
  DROP INDEX "space_files_filename_idx";
  ALTER TABLE "space_files" DROP COLUMN "space_id";
  ALTER TABLE "space_files" DROP COLUMN "post_id";
  ALTER TABLE "space_files" DROP COLUMN "comment_id";
  ALTER TABLE "space_files" DROP COLUMN "prefix";
  ALTER TABLE "space_files" DROP COLUMN "_objectkey";
  ALTER TABLE "space_files" DROP COLUMN "url";
  ALTER TABLE "space_files" DROP COLUMN "thumbnail_u_r_l";
  ALTER TABLE "space_files" DROP COLUMN "filename";
  ALTER TABLE "space_files" DROP COLUMN "mime_type";
  ALTER TABLE "space_files" DROP COLUMN "filesize";
  ALTER TABLE "space_files" DROP COLUMN "width";
  ALTER TABLE "space_files" DROP COLUMN "height";
  ALTER TABLE "space_files" DROP COLUMN "focal_x";
  ALTER TABLE "space_files" DROP COLUMN "focal_y";`)
}
