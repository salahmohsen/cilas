import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "forms_blocks_radio_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_radio_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_radio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_radio_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_checkbox_group" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_checkbox_group_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  ALTER TABLE "forms_blocks_checkbox_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_email_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_number_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_select_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_text_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_textarea" ADD COLUMN "image_id" integer;
  ALTER TABLE "forms_blocks_textarea" ADD COLUMN "min_words" numeric;
  ALTER TABLE "forms_blocks_textarea_locales" ADD COLUMN "description" varchar;
  ALTER TABLE "forms_blocks_radio_options" ADD CONSTRAINT "forms_blocks_radio_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_radio_options_locales" ADD CONSTRAINT "forms_blocks_radio_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_radio_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_radio" ADD CONSTRAINT "forms_blocks_radio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_radio_locales" ADD CONSTRAINT "forms_blocks_radio_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_options" ADD CONSTRAINT "forms_blocks_checkbox_group_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_options_locales" ADD CONSTRAINT "forms_blocks_checkbox_group_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group" ADD CONSTRAINT "forms_blocks_checkbox_group_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_group_locales" ADD CONSTRAINT "forms_blocks_checkbox_group_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "forms_blocks_radio_options_order_idx" ON "forms_blocks_radio_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_radio_options_parent_id_idx" ON "forms_blocks_radio_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_radio_options_locales_locale_parent_id_unique" ON "forms_blocks_radio_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_radio_order_idx" ON "forms_blocks_radio" USING btree ("_order");
  CREATE INDEX "forms_blocks_radio_parent_id_idx" ON "forms_blocks_radio" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_radio_path_idx" ON "forms_blocks_radio" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_radio_locales_locale_parent_id_unique" ON "forms_blocks_radio_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_options_order_idx" ON "forms_blocks_checkbox_group_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_group_options_parent_id_idx" ON "forms_blocks_checkbox_group_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_group_options_locales_locale_parent_id" ON "forms_blocks_checkbox_group_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_order_idx" ON "forms_blocks_checkbox_group" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_group_parent_id_idx" ON "forms_blocks_checkbox_group" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_path_idx" ON "forms_blocks_checkbox_group" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_group_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_group_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "forms_blocks_textarea" ADD CONSTRAINT "forms_blocks_textarea_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "forms_blocks_textarea_image_idx" ON "forms_blocks_textarea" USING btree ("image_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "forms_blocks_radio_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_radio_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_radio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_radio_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_checkbox_group_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "forms_blocks_radio_options" CASCADE;
  DROP TABLE "forms_blocks_radio_options_locales" CASCADE;
  DROP TABLE "forms_blocks_radio" CASCADE;
  DROP TABLE "forms_blocks_radio_locales" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_options" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_options_locales" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group" CASCADE;
  DROP TABLE "forms_blocks_checkbox_group_locales" CASCADE;
  ALTER TABLE "forms_blocks_textarea" DROP CONSTRAINT "forms_blocks_textarea_image_id_media_id_fk";
  
  DROP INDEX "forms_blocks_textarea_image_idx";
  ALTER TABLE "forms_blocks_checkbox_locales" DROP COLUMN "description";
  ALTER TABLE "forms_blocks_email_locales" DROP COLUMN "description";
  ALTER TABLE "forms_blocks_number_locales" DROP COLUMN "description";
  ALTER TABLE "forms_blocks_select_locales" DROP COLUMN "description";
  ALTER TABLE "forms_blocks_text_locales" DROP COLUMN "description";
  ALTER TABLE "forms_blocks_textarea" DROP COLUMN "image_id";
  ALTER TABLE "forms_blocks_textarea" DROP COLUMN "min_words";
  ALTER TABLE "forms_blocks_textarea_locales" DROP COLUMN "description";`)
}
