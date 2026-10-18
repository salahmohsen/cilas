import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletters_blocks_gallery_columns" AS ENUM('2', '3');
  CREATE TYPE "public"."enum__newsletters_v_blocks_gallery_columns" AS ENUM('2', '3');
  CREATE TABLE "newsletters_blocks_picks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "newsletters_blocks_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar
  );
  
  CREATE TABLE "newsletters_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum_newsletters_blocks_gallery_columns" DEFAULT '2',
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "newsletters_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_picks_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_gallery_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_gallery" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"heading" varchar,
  	"columns" "enum__newsletters_v_blocks_gallery_columns" DEFAULT '2',
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_quote" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"text" varchar,
  	"attribution" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"body" jsonb,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "newsletters_rels" ADD COLUMN "publications_id" integer;
  ALTER TABLE "newsletters_rels" ADD COLUMN "cycles_id" integer;
  ALTER TABLE "newsletters_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "_newsletters_v_rels" ADD COLUMN "publications_id" integer;
  ALTER TABLE "_newsletters_v_rels" ADD COLUMN "cycles_id" integer;
  ALTER TABLE "_newsletters_v_rels" ADD COLUMN "events_id" integer;
  ALTER TABLE "email_settings" ADD COLUMN "signoff" varchar;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters_blocks_picks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks" ADD CONSTRAINT "newsletters_blocks_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery_images" ADD CONSTRAINT "newsletters_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery_images" ADD CONSTRAINT "newsletters_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_gallery" ADD CONSTRAINT "newsletters_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_quote" ADD CONSTRAINT "newsletters_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_text" ADD CONSTRAINT "newsletters_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v_blocks_picks"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks" ADD CONSTRAINT "_newsletters_v_blocks_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" ADD CONSTRAINT "_newsletters_v_blocks_gallery_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" ADD CONSTRAINT "_newsletters_v_blocks_gallery_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v_blocks_gallery"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_gallery" ADD CONSTRAINT "_newsletters_v_blocks_gallery_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_quote" ADD CONSTRAINT "_newsletters_v_blocks_quote_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_text" ADD CONSTRAINT "_newsletters_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_blocks_picks_items_order_idx" ON "newsletters_blocks_picks_items" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_picks_items_parent_id_idx" ON "newsletters_blocks_picks_items" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_picks_order_idx" ON "newsletters_blocks_picks" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_picks_parent_id_idx" ON "newsletters_blocks_picks" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_picks_path_idx" ON "newsletters_blocks_picks" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_gallery_images_order_idx" ON "newsletters_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_gallery_images_parent_id_idx" ON "newsletters_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_gallery_images_image_idx" ON "newsletters_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "newsletters_blocks_gallery_order_idx" ON "newsletters_blocks_gallery" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_gallery_parent_id_idx" ON "newsletters_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_gallery_path_idx" ON "newsletters_blocks_gallery" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_quote_order_idx" ON "newsletters_blocks_quote" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_quote_parent_id_idx" ON "newsletters_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_quote_path_idx" ON "newsletters_blocks_quote" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_text_order_idx" ON "newsletters_blocks_text" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_text_parent_id_idx" ON "newsletters_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_text_path_idx" ON "newsletters_blocks_text" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_picks_items_order_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_picks_items_parent_id_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_picks_order_idx" ON "_newsletters_v_blocks_picks" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_picks_parent_id_idx" ON "_newsletters_v_blocks_picks" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_picks_path_idx" ON "_newsletters_v_blocks_picks" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_order_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_parent_id_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_images_image_idx" ON "_newsletters_v_blocks_gallery_images" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_order_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_gallery_parent_id_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_gallery_path_idx" ON "_newsletters_v_blocks_gallery" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_quote_order_idx" ON "_newsletters_v_blocks_quote" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_quote_parent_id_idx" ON "_newsletters_v_blocks_quote" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_quote_path_idx" ON "_newsletters_v_blocks_quote" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_text_order_idx" ON "_newsletters_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_text_parent_id_idx" ON "_newsletters_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_text_path_idx" ON "_newsletters_v_blocks_text" USING btree ("_path");
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_rels_publications_id_idx" ON "newsletters_rels" USING btree ("publications_id");
  CREATE INDEX "newsletters_rels_cycles_id_idx" ON "newsletters_rels" USING btree ("cycles_id");
  CREATE INDEX "newsletters_rels_events_id_idx" ON "newsletters_rels" USING btree ("events_id");
  CREATE INDEX "_newsletters_v_rels_publications_id_idx" ON "_newsletters_v_rels" USING btree ("publications_id");
  CREATE INDEX "_newsletters_v_rels_cycles_id_idx" ON "_newsletters_v_rels" USING btree ("cycles_id");
  CREATE INDEX "_newsletters_v_rels_events_id_idx" ON "_newsletters_v_rels" USING btree ("events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters_blocks_picks_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_picks_items" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_gallery_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_gallery" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_quote" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters_blocks_picks_items" CASCADE;
  DROP TABLE "newsletters_blocks_picks" CASCADE;
  DROP TABLE "newsletters_blocks_gallery_images" CASCADE;
  DROP TABLE "newsletters_blocks_gallery" CASCADE;
  DROP TABLE "newsletters_blocks_quote" CASCADE;
  DROP TABLE "newsletters_blocks_text" CASCADE;
  DROP TABLE "_newsletters_v_blocks_picks_items" CASCADE;
  DROP TABLE "_newsletters_v_blocks_picks" CASCADE;
  DROP TABLE "_newsletters_v_blocks_gallery_images" CASCADE;
  DROP TABLE "_newsletters_v_blocks_gallery" CASCADE;
  DROP TABLE "_newsletters_v_blocks_quote" CASCADE;
  DROP TABLE "_newsletters_v_blocks_text" CASCADE;
  ALTER TABLE "newsletters_rels" DROP CONSTRAINT "newsletters_rels_publications_fk";
  
  ALTER TABLE "newsletters_rels" DROP CONSTRAINT "newsletters_rels_cycles_fk";
  
  ALTER TABLE "newsletters_rels" DROP CONSTRAINT "newsletters_rels_events_fk";
  
  ALTER TABLE "_newsletters_v_rels" DROP CONSTRAINT "_newsletters_v_rels_publications_fk";
  
  ALTER TABLE "_newsletters_v_rels" DROP CONSTRAINT "_newsletters_v_rels_cycles_fk";
  
  ALTER TABLE "_newsletters_v_rels" DROP CONSTRAINT "_newsletters_v_rels_events_fk";
  
  DROP INDEX "newsletters_rels_publications_id_idx";
  DROP INDEX "newsletters_rels_cycles_id_idx";
  DROP INDEX "newsletters_rels_events_id_idx";
  DROP INDEX "_newsletters_v_rels_publications_id_idx";
  DROP INDEX "_newsletters_v_rels_cycles_id_idx";
  DROP INDEX "_newsletters_v_rels_events_id_idx";
  ALTER TABLE "newsletters_rels" DROP COLUMN "publications_id";
  ALTER TABLE "newsletters_rels" DROP COLUMN "cycles_id";
  ALTER TABLE "newsletters_rels" DROP COLUMN "events_id";
  ALTER TABLE "_newsletters_v_rels" DROP COLUMN "publications_id";
  ALTER TABLE "_newsletters_v_rels" DROP COLUMN "cycles_id";
  ALTER TABLE "_newsletters_v_rels" DROP COLUMN "events_id";
  ALTER TABLE "email_settings" DROP COLUMN "signoff";
  DROP TYPE "public"."enum_newsletters_blocks_gallery_columns";
  DROP TYPE "public"."enum__newsletters_v_blocks_gallery_columns";`)
}
