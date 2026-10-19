import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_blocks_file_upload_accept" AS ENUM('pdf', 'word', 'image');
  CREATE TYPE "public"."enum__courses_v_blocks_file_upload_accept" AS ENUM('pdf', 'word', 'image');
  CREATE TYPE "public"."enum_forms_blocks_file_upload_accept" AS ENUM('pdf', 'word', 'image');
  CREATE TABLE "courses_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_text_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"image_id" integer,
  	"min_words" numeric,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_textarea_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_radio_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "courses_blocks_radio_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_radio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_radio_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_checkbox_group_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "courses_blocks_checkbox_group_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_checkbox_group" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_checkbox_group_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"default_value" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_checkbox_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar
  );
  
  CREATE TABLE "courses_blocks_select_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"placeholder" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_select_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_number" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"default_value" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_number_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_blocks_file_upload_accept" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_courses_blocks_file_upload_accept",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "courses_blocks_file_upload" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"max_size_m_b" numeric DEFAULT 10,
  	"multiple" boolean,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "courses_blocks_file_upload_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_text_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"image_id" integer,
  	"min_words" numeric,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_textarea_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_radio_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_radio_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_radio" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_radio_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox_group_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox_group_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox_group" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox_group_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"required" boolean,
  	"default_value" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_checkbox_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"value" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_select_options_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"placeholder" varchar,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_select_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_number" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"width" numeric,
  	"default_value" numeric,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_number_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_file_upload_accept" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__courses_v_blocks_file_upload_accept",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_courses_v_blocks_file_upload" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"max_size_m_b" numeric DEFAULT 10,
  	"multiple" boolean,
  	"required" boolean,
  	"_uuid" varchar,
  	"block_name" varchar
  );
  
  CREATE TABLE "_courses_v_blocks_file_upload_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "submission_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"field" varchar,
  	"prefix" varchar DEFAULT 'applications',
  	"_objectkey" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
  CREATE TABLE "forms_blocks_file_upload_accept" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_forms_blocks_file_upload_accept",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "forms_blocks_file_upload" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"max_size_m_b" numeric DEFAULT 10,
  	"multiple" boolean,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_file_upload_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "submission_files_id" integer;
  ALTER TABLE "courses_blocks_text" ADD CONSTRAINT "courses_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_text_locales" ADD CONSTRAINT "courses_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_textarea" ADD CONSTRAINT "courses_blocks_textarea_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_blocks_textarea" ADD CONSTRAINT "courses_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_textarea_locales" ADD CONSTRAINT "courses_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_radio_options" ADD CONSTRAINT "courses_blocks_radio_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_radio_options_locales" ADD CONSTRAINT "courses_blocks_radio_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_radio_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_radio" ADD CONSTRAINT "courses_blocks_radio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_radio_locales" ADD CONSTRAINT "courses_blocks_radio_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox_group_options" ADD CONSTRAINT "courses_blocks_checkbox_group_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox_group_options_locales" ADD CONSTRAINT "courses_blocks_checkbox_group_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_checkbox_group_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox_group" ADD CONSTRAINT "courses_blocks_checkbox_group_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox_group_locales" ADD CONSTRAINT "courses_blocks_checkbox_group_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox" ADD CONSTRAINT "courses_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_checkbox_locales" ADD CONSTRAINT "courses_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_select_options" ADD CONSTRAINT "courses_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_select_options_locales" ADD CONSTRAINT "courses_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_select" ADD CONSTRAINT "courses_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_select_locales" ADD CONSTRAINT "courses_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_number" ADD CONSTRAINT "courses_blocks_number_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_number_locales" ADD CONSTRAINT "courses_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_file_upload_accept" ADD CONSTRAINT "courses_blocks_file_upload_accept_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_file_upload" ADD CONSTRAINT "courses_blocks_file_upload_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_blocks_file_upload_locales" ADD CONSTRAINT "courses_blocks_file_upload_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_text" ADD CONSTRAINT "_courses_v_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_text_locales" ADD CONSTRAINT "_courses_v_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_textarea" ADD CONSTRAINT "_courses_v_blocks_textarea_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_textarea" ADD CONSTRAINT "_courses_v_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_textarea_locales" ADD CONSTRAINT "_courses_v_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_radio_options" ADD CONSTRAINT "_courses_v_blocks_radio_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_radio_options_locales" ADD CONSTRAINT "_courses_v_blocks_radio_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_radio_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_radio" ADD CONSTRAINT "_courses_v_blocks_radio_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_radio_locales" ADD CONSTRAINT "_courses_v_blocks_radio_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_radio"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox_group_options" ADD CONSTRAINT "_courses_v_blocks_checkbox_group_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox_group_options_locales" ADD CONSTRAINT "_courses_v_blocks_checkbox_group_options_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_checkbox_group_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox_group" ADD CONSTRAINT "_courses_v_blocks_checkbox_group_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox_group_locales" ADD CONSTRAINT "_courses_v_blocks_checkbox_group_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_checkbox_group"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox" ADD CONSTRAINT "_courses_v_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_checkbox_locales" ADD CONSTRAINT "_courses_v_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_select_options" ADD CONSTRAINT "_courses_v_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_select_options_locales" ADD CONSTRAINT "_courses_v_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_select" ADD CONSTRAINT "_courses_v_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_select_locales" ADD CONSTRAINT "_courses_v_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_number" ADD CONSTRAINT "_courses_v_blocks_number_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_number_locales" ADD CONSTRAINT "_courses_v_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_file_upload_accept" ADD CONSTRAINT "_courses_v_blocks_file_upload_accept_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_courses_v_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_file_upload" ADD CONSTRAINT "_courses_v_blocks_file_upload_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_blocks_file_upload_locales" ADD CONSTRAINT "_courses_v_blocks_file_upload_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_file_upload_accept" ADD CONSTRAINT "forms_blocks_file_upload_accept_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."forms_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_file_upload" ADD CONSTRAINT "forms_blocks_file_upload_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_file_upload_locales" ADD CONSTRAINT "forms_blocks_file_upload_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_file_upload"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_blocks_text_order_idx" ON "courses_blocks_text" USING btree ("_order");
  CREATE INDEX "courses_blocks_text_parent_id_idx" ON "courses_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_text_path_idx" ON "courses_blocks_text" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_text_locales_locale_parent_id_unique" ON "courses_blocks_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_text_locales_parent_id_idx" ON "courses_blocks_text_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_textarea_order_idx" ON "courses_blocks_textarea" USING btree ("_order");
  CREATE INDEX "courses_blocks_textarea_parent_id_idx" ON "courses_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_textarea_path_idx" ON "courses_blocks_textarea" USING btree ("_path");
  CREATE INDEX "courses_blocks_textarea_image_idx" ON "courses_blocks_textarea" USING btree ("image_id");
  CREATE UNIQUE INDEX "courses_blocks_textarea_locales_locale_parent_id_unique" ON "courses_blocks_textarea_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_textarea_locales_parent_id_idx" ON "courses_blocks_textarea_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_radio_options_order_idx" ON "courses_blocks_radio_options" USING btree ("_order");
  CREATE INDEX "courses_blocks_radio_options_parent_id_idx" ON "courses_blocks_radio_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_blocks_radio_options_locales_locale_parent_id_unique" ON "courses_blocks_radio_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_radio_options_locales_parent_id_idx" ON "courses_blocks_radio_options_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_radio_order_idx" ON "courses_blocks_radio" USING btree ("_order");
  CREATE INDEX "courses_blocks_radio_parent_id_idx" ON "courses_blocks_radio" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_radio_path_idx" ON "courses_blocks_radio" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_radio_locales_locale_parent_id_unique" ON "courses_blocks_radio_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_radio_locales_parent_id_idx" ON "courses_blocks_radio_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_checkbox_group_options_order_idx" ON "courses_blocks_checkbox_group_options" USING btree ("_order");
  CREATE INDEX "courses_blocks_checkbox_group_options_parent_id_idx" ON "courses_blocks_checkbox_group_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_blocks_checkbox_group_options_locales_locale_parent_" ON "courses_blocks_checkbox_group_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_checkbox_group_options_locales_parent_id_idx" ON "courses_blocks_checkbox_group_options_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_checkbox_group_order_idx" ON "courses_blocks_checkbox_group" USING btree ("_order");
  CREATE INDEX "courses_blocks_checkbox_group_parent_id_idx" ON "courses_blocks_checkbox_group" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_checkbox_group_path_idx" ON "courses_blocks_checkbox_group" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_checkbox_group_locales_locale_parent_id_uniqu" ON "courses_blocks_checkbox_group_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_checkbox_group_locales_parent_id_idx" ON "courses_blocks_checkbox_group_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_checkbox_order_idx" ON "courses_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "courses_blocks_checkbox_parent_id_idx" ON "courses_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_checkbox_path_idx" ON "courses_blocks_checkbox" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_checkbox_locales_locale_parent_id_unique" ON "courses_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_checkbox_locales_parent_id_idx" ON "courses_blocks_checkbox_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_select_options_order_idx" ON "courses_blocks_select_options" USING btree ("_order");
  CREATE INDEX "courses_blocks_select_options_parent_id_idx" ON "courses_blocks_select_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_blocks_select_options_locales_locale_parent_id_uniqu" ON "courses_blocks_select_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_select_options_locales_parent_id_idx" ON "courses_blocks_select_options_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_select_order_idx" ON "courses_blocks_select" USING btree ("_order");
  CREATE INDEX "courses_blocks_select_parent_id_idx" ON "courses_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_select_path_idx" ON "courses_blocks_select" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_select_locales_locale_parent_id_unique" ON "courses_blocks_select_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_select_locales_parent_id_idx" ON "courses_blocks_select_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_number_order_idx" ON "courses_blocks_number" USING btree ("_order");
  CREATE INDEX "courses_blocks_number_parent_id_idx" ON "courses_blocks_number" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_number_path_idx" ON "courses_blocks_number" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_number_locales_locale_parent_id_unique" ON "courses_blocks_number_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_number_locales_parent_id_idx" ON "courses_blocks_number_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_file_upload_accept_order_idx" ON "courses_blocks_file_upload_accept" USING btree ("order");
  CREATE INDEX "courses_blocks_file_upload_accept_parent_idx" ON "courses_blocks_file_upload_accept" USING btree ("parent_id");
  CREATE INDEX "courses_blocks_file_upload_order_idx" ON "courses_blocks_file_upload" USING btree ("_order");
  CREATE INDEX "courses_blocks_file_upload_parent_id_idx" ON "courses_blocks_file_upload" USING btree ("_parent_id");
  CREATE INDEX "courses_blocks_file_upload_path_idx" ON "courses_blocks_file_upload" USING btree ("_path");
  CREATE UNIQUE INDEX "courses_blocks_file_upload_locales_locale_parent_id_unique" ON "courses_blocks_file_upload_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_blocks_file_upload_locales_parent_id_idx" ON "courses_blocks_file_upload_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_text_order_idx" ON "_courses_v_blocks_text" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_text_parent_id_idx" ON "_courses_v_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_text_path_idx" ON "_courses_v_blocks_text" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_text_locales_locale_parent_id_unique" ON "_courses_v_blocks_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_text_locales_parent_id_idx" ON "_courses_v_blocks_text_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_textarea_order_idx" ON "_courses_v_blocks_textarea" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_textarea_parent_id_idx" ON "_courses_v_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_textarea_path_idx" ON "_courses_v_blocks_textarea" USING btree ("_path");
  CREATE INDEX "_courses_v_blocks_textarea_image_idx" ON "_courses_v_blocks_textarea" USING btree ("image_id");
  CREATE UNIQUE INDEX "_courses_v_blocks_textarea_locales_locale_parent_id_unique" ON "_courses_v_blocks_textarea_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_textarea_locales_parent_id_idx" ON "_courses_v_blocks_textarea_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_radio_options_order_idx" ON "_courses_v_blocks_radio_options" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_radio_options_parent_id_idx" ON "_courses_v_blocks_radio_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_blocks_radio_options_locales_locale_parent_id_uni" ON "_courses_v_blocks_radio_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_radio_options_locales_parent_id_idx" ON "_courses_v_blocks_radio_options_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_radio_order_idx" ON "_courses_v_blocks_radio" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_radio_parent_id_idx" ON "_courses_v_blocks_radio" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_radio_path_idx" ON "_courses_v_blocks_radio" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_radio_locales_locale_parent_id_unique" ON "_courses_v_blocks_radio_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_radio_locales_parent_id_idx" ON "_courses_v_blocks_radio_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_group_options_order_idx" ON "_courses_v_blocks_checkbox_group_options" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_checkbox_group_options_parent_id_idx" ON "_courses_v_blocks_checkbox_group_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_blocks_checkbox_group_options_locales_locale_pare" ON "_courses_v_blocks_checkbox_group_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_group_options_locales_parent__idx" ON "_courses_v_blocks_checkbox_group_options_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_group_order_idx" ON "_courses_v_blocks_checkbox_group" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_checkbox_group_parent_id_idx" ON "_courses_v_blocks_checkbox_group" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_group_path_idx" ON "_courses_v_blocks_checkbox_group" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_checkbox_group_locales_locale_parent_id_un" ON "_courses_v_blocks_checkbox_group_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_group_locales_parent_id_idx" ON "_courses_v_blocks_checkbox_group_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_order_idx" ON "_courses_v_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_checkbox_parent_id_idx" ON "_courses_v_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_path_idx" ON "_courses_v_blocks_checkbox" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_checkbox_locales_locale_parent_id_unique" ON "_courses_v_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_checkbox_locales_parent_id_idx" ON "_courses_v_blocks_checkbox_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_select_options_order_idx" ON "_courses_v_blocks_select_options" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_select_options_parent_id_idx" ON "_courses_v_blocks_select_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_blocks_select_options_locales_locale_parent_id_un" ON "_courses_v_blocks_select_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_select_options_locales_parent_id_idx" ON "_courses_v_blocks_select_options_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_select_order_idx" ON "_courses_v_blocks_select" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_select_parent_id_idx" ON "_courses_v_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_select_path_idx" ON "_courses_v_blocks_select" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_select_locales_locale_parent_id_unique" ON "_courses_v_blocks_select_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_select_locales_parent_id_idx" ON "_courses_v_blocks_select_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_number_order_idx" ON "_courses_v_blocks_number" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_number_parent_id_idx" ON "_courses_v_blocks_number" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_number_path_idx" ON "_courses_v_blocks_number" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_number_locales_locale_parent_id_unique" ON "_courses_v_blocks_number_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_number_locales_parent_id_idx" ON "_courses_v_blocks_number_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_file_upload_accept_order_idx" ON "_courses_v_blocks_file_upload_accept" USING btree ("order");
  CREATE INDEX "_courses_v_blocks_file_upload_accept_parent_idx" ON "_courses_v_blocks_file_upload_accept" USING btree ("parent_id");
  CREATE INDEX "_courses_v_blocks_file_upload_order_idx" ON "_courses_v_blocks_file_upload" USING btree ("_order");
  CREATE INDEX "_courses_v_blocks_file_upload_parent_id_idx" ON "_courses_v_blocks_file_upload" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_blocks_file_upload_path_idx" ON "_courses_v_blocks_file_upload" USING btree ("_path");
  CREATE UNIQUE INDEX "_courses_v_blocks_file_upload_locales_locale_parent_id_uniqu" ON "_courses_v_blocks_file_upload_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_blocks_file_upload_locales_parent_id_idx" ON "_courses_v_blocks_file_upload_locales" USING btree ("_parent_id");
  CREATE INDEX "submission_files_updated_at_idx" ON "submission_files" USING btree ("updated_at");
  CREATE INDEX "submission_files_created_at_idx" ON "submission_files" USING btree ("created_at");
  CREATE UNIQUE INDEX "submission_files_filename_idx" ON "submission_files" USING btree ("filename");
  CREATE INDEX "forms_blocks_file_upload_accept_order_idx" ON "forms_blocks_file_upload_accept" USING btree ("order");
  CREATE INDEX "forms_blocks_file_upload_accept_parent_idx" ON "forms_blocks_file_upload_accept" USING btree ("parent_id");
  CREATE INDEX "forms_blocks_file_upload_order_idx" ON "forms_blocks_file_upload" USING btree ("_order");
  CREATE INDEX "forms_blocks_file_upload_parent_id_idx" ON "forms_blocks_file_upload" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_file_upload_path_idx" ON "forms_blocks_file_upload" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_file_upload_locales_locale_parent_id_unique" ON "forms_blocks_file_upload_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_file_upload_locales_parent_id_idx" ON "forms_blocks_file_upload_locales" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_submission_files_fk" FOREIGN KEY ("submission_files_id") REFERENCES "public"."submission_files"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_submission_files_id_idx" ON "payload_locked_documents_rels" USING btree ("submission_files_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_textarea" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_textarea_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_radio_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_radio_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_radio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_radio_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox_group_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox_group_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox_group" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox_group_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_checkbox_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_select_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_select_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_select" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_select_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_number" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_number_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_file_upload_accept" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_file_upload" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "courses_blocks_file_upload_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_text" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_text_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_textarea" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_textarea_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_radio_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_radio_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_radio" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_radio_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox_group_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox_group_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox_group" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox_group_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_checkbox_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_select_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_select_options_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_select" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_select_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_number" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_number_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_file_upload_accept" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_file_upload" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_blocks_file_upload_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "submission_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_file_upload_accept" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_file_upload" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "forms_blocks_file_upload_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "courses_blocks_text" CASCADE;
  DROP TABLE "courses_blocks_text_locales" CASCADE;
  DROP TABLE "courses_blocks_textarea" CASCADE;
  DROP TABLE "courses_blocks_textarea_locales" CASCADE;
  DROP TABLE "courses_blocks_radio_options" CASCADE;
  DROP TABLE "courses_blocks_radio_options_locales" CASCADE;
  DROP TABLE "courses_blocks_radio" CASCADE;
  DROP TABLE "courses_blocks_radio_locales" CASCADE;
  DROP TABLE "courses_blocks_checkbox_group_options" CASCADE;
  DROP TABLE "courses_blocks_checkbox_group_options_locales" CASCADE;
  DROP TABLE "courses_blocks_checkbox_group" CASCADE;
  DROP TABLE "courses_blocks_checkbox_group_locales" CASCADE;
  DROP TABLE "courses_blocks_checkbox" CASCADE;
  DROP TABLE "courses_blocks_checkbox_locales" CASCADE;
  DROP TABLE "courses_blocks_select_options" CASCADE;
  DROP TABLE "courses_blocks_select_options_locales" CASCADE;
  DROP TABLE "courses_blocks_select" CASCADE;
  DROP TABLE "courses_blocks_select_locales" CASCADE;
  DROP TABLE "courses_blocks_number" CASCADE;
  DROP TABLE "courses_blocks_number_locales" CASCADE;
  DROP TABLE "courses_blocks_file_upload_accept" CASCADE;
  DROP TABLE "courses_blocks_file_upload" CASCADE;
  DROP TABLE "courses_blocks_file_upload_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_text" CASCADE;
  DROP TABLE "_courses_v_blocks_text_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_textarea" CASCADE;
  DROP TABLE "_courses_v_blocks_textarea_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_radio_options" CASCADE;
  DROP TABLE "_courses_v_blocks_radio_options_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_radio" CASCADE;
  DROP TABLE "_courses_v_blocks_radio_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox_group_options" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox_group_options_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox_group" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox_group_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox" CASCADE;
  DROP TABLE "_courses_v_blocks_checkbox_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_select_options" CASCADE;
  DROP TABLE "_courses_v_blocks_select_options_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_select" CASCADE;
  DROP TABLE "_courses_v_blocks_select_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_number" CASCADE;
  DROP TABLE "_courses_v_blocks_number_locales" CASCADE;
  DROP TABLE "_courses_v_blocks_file_upload_accept" CASCADE;
  DROP TABLE "_courses_v_blocks_file_upload" CASCADE;
  DROP TABLE "_courses_v_blocks_file_upload_locales" CASCADE;
  DROP TABLE "submission_files" CASCADE;
  DROP TABLE "forms_blocks_file_upload_accept" CASCADE;
  DROP TABLE "forms_blocks_file_upload" CASCADE;
  DROP TABLE "forms_blocks_file_upload_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_submission_files_fk";
  
  DROP INDEX "payload_locked_documents_rels_submission_files_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "submission_files_id";
  DROP TYPE "public"."enum_courses_blocks_file_upload_accept";
  DROP TYPE "public"."enum__courses_v_blocks_file_upload_accept";
  DROP TYPE "public"."enum_forms_blocks_file_upload_accept";`)
}
