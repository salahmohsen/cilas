import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "newsletters_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_newsletters_v_blocks_image" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"image_id" integer,
  	"caption" varchar,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_image" ADD CONSTRAINT "newsletters_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_image" ADD CONSTRAINT "_newsletters_v_blocks_image_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_blocks_image_order_idx" ON "newsletters_blocks_image" USING btree ("_order");
  CREATE INDEX "newsletters_blocks_image_parent_id_idx" ON "newsletters_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "newsletters_blocks_image_path_idx" ON "newsletters_blocks_image" USING btree ("_path");
  CREATE INDEX "newsletters_blocks_image_image_idx" ON "newsletters_blocks_image" USING btree ("image_id");
  CREATE INDEX "_newsletters_v_blocks_image_order_idx" ON "_newsletters_v_blocks_image" USING btree ("_order");
  CREATE INDEX "_newsletters_v_blocks_image_parent_id_idx" ON "_newsletters_v_blocks_image" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_blocks_image_path_idx" ON "_newsletters_v_blocks_image" USING btree ("_path");
  CREATE INDEX "_newsletters_v_blocks_image_image_idx" ON "_newsletters_v_blocks_image" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "newsletters_blocks_image" CASCADE;
  DROP TABLE "_newsletters_v_blocks_image" CASCADE;`)
}
