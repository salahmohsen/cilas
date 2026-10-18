import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_exports_format" AS ENUM('csv', 'json');
  CREATE TYPE "public"."enum_exports_sort_order" AS ENUM('asc', 'desc');
  CREATE TYPE "public"."enum_exports_locale" AS ENUM('all', 'en', 'ar');
  CREATE TYPE "public"."enum_exports_drafts" AS ENUM('yes', 'no');
  CREATE TYPE "public"."enum_imports_import_mode" AS ENUM('create', 'update', 'upsert');
  CREATE TYPE "public"."enum_imports_status" AS ENUM('pending', 'completed', 'partial', 'failed');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'createCollectionExport', 'createCollectionImport');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'createCollectionExport', 'createCollectionImport');
  CREATE TABLE "exports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"format" "enum_exports_format" DEFAULT 'csv' NOT NULL,
  	"limit" numeric,
  	"page" numeric DEFAULT 1,
  	"sort" varchar,
  	"sort_order" "enum_exports_sort_order",
  	"locale" "enum_exports_locale" DEFAULT 'all',
  	"drafts" "enum_exports_drafts" DEFAULT 'yes',
  	"collection_slug" varchar DEFAULT 'form-submissions' NOT NULL,
  	"where" jsonb DEFAULT '{}'::jsonb,
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
  
  CREATE TABLE "exports_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "imports" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection_slug" varchar NOT NULL,
  	"import_mode" "enum_imports_import_mode",
  	"match_field" varchar DEFAULT 'id',
  	"status" "enum_imports_status" DEFAULT 'pending',
  	"summary_imported" numeric,
  	"summary_updated" numeric,
  	"summary_total" numeric,
  	"summary_issues" numeric,
  	"summary_issue_details" jsonb,
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
  
  CREATE TABLE "payload_jobs_log" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"executed_at" timestamp(3) with time zone NOT NULL,
  	"completed_at" timestamp(3) with time zone NOT NULL,
  	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
  	"task_i_d" varchar NOT NULL,
  	"input" jsonb,
  	"output" jsonb,
  	"state" "enum_payload_jobs_log_state" NOT NULL,
  	"error" jsonb
  );
  
  CREATE TABLE "payload_jobs" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"input" jsonb,
  	"completed_at" timestamp(3) with time zone,
  	"total_tried" numeric DEFAULT 0,
  	"has_error" boolean DEFAULT false,
  	"error" jsonb,
  	"task_slug" "enum_payload_jobs_task_slug",
  	"queue" varchar DEFAULT 'default',
  	"wait_until" timestamp(3) with time zone,
  	"processing" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "exports_texts" ADD CONSTRAINT "exports_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."exports"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "exports_updated_at_idx" ON "exports" USING btree ("updated_at");
  CREATE INDEX "exports_created_at_idx" ON "exports" USING btree ("created_at");
  CREATE UNIQUE INDEX "exports_filename_idx" ON "exports" USING btree ("filename");
  CREATE INDEX "exports_texts_order_parent" ON "exports_texts" USING btree ("order","parent_id");
  CREATE INDEX "imports_updated_at_idx" ON "imports" USING btree ("updated_at");
  CREATE INDEX "imports_created_at_idx" ON "imports" USING btree ("created_at");
  CREATE UNIQUE INDEX "imports_filename_idx" ON "imports" USING btree ("filename");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "people_locales_parent_id_idx" ON "people_locales" USING btree ("_parent_id");
  CREATE INDEX "memberships_locales_parent_id_idx" ON "memberships_locales" USING btree ("_parent_id");
  CREATE INDEX "course_price_plans_locales_parent_id_idx" ON "course_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_sessions_bibliography_locales_parent_id_idx" ON "courses_sessions_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_sessions_activities_locales_parent_id_idx" ON "courses_sessions_activities_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_sessions_locales_parent_id_idx" ON "courses_sessions_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_bibliography_locales_parent_id_idx" ON "courses_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "courses_locales_parent_id_idx" ON "courses_locales" USING btree ("_parent_id");
  CREATE INDEX "_course_price_plans_v_locales_parent_id_idx" ON "_course_price_plans_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_sessions_bibliography_locales_parent__idx" ON "_courses_v_version_sessions_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_sessions_activities_locales_parent_id_idx" ON "_courses_v_version_sessions_activities_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_sessions_locales_parent_id_idx" ON "_courses_v_version_sessions_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_bibliography_locales_parent_id_idx" ON "_courses_v_version_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_locales_parent_id_idx" ON "_courses_v_locales" USING btree ("_parent_id");
  CREATE INDEX "enrollments_locales_parent_id_idx" ON "enrollments_locales" USING btree ("_parent_id");
  CREATE INDEX "programmes_highlights_locales_parent_id_idx" ON "programmes_highlights_locales" USING btree ("_parent_id");
  CREATE INDEX "programmes_components_locales_parent_id_idx" ON "programmes_components_locales" USING btree ("_parent_id");
  CREATE INDEX "programme_price_plans_locales_parent_id_idx" ON "programme_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "programmes_testimonials_locales_parent_id_idx" ON "programmes_testimonials_locales" USING btree ("_parent_id");
  CREATE INDEX "programmes_locales_parent_id_idx" ON "programmes_locales" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_version_highlights_locales_parent_id_idx" ON "_programmes_v_version_highlights_locales" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_version_components_locales_parent_id_idx" ON "_programmes_v_version_components_locales" USING btree ("_parent_id");
  CREATE INDEX "_programme_price_plans_v_locales_parent_id_idx" ON "_programme_price_plans_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_version_testimonials_locales_parent_id_idx" ON "_programmes_v_version_testimonials_locales" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_locales_parent_id_idx" ON "_programmes_v_locales" USING btree ("_parent_id");
  CREATE INDEX "cycle_price_plans_locales_parent_id_idx" ON "cycle_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "cycles_pricing_locales_parent_id_idx" ON "cycles_pricing_locales" USING btree ("_parent_id");
  CREATE INDEX "cycles_locales_parent_id_idx" ON "cycles_locales" USING btree ("_parent_id");
  CREATE INDEX "governance_locales_parent_id_idx" ON "governance_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_credits_locales_parent_id_idx" ON "articles_credits_locales" USING btree ("_parent_id");
  CREATE INDEX "articles_locales_parent_id_idx" ON "articles_locales" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_version_credits_locales_parent_id_idx" ON "_articles_v_version_credits_locales" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_locales_parent_id_idx" ON "_articles_v_locales" USING btree ("_parent_id");
  CREATE INDEX "publications_credits_locales_parent_id_idx" ON "publications_credits_locales" USING btree ("_parent_id");
  CREATE INDEX "publications_locales_parent_id_idx" ON "publications_locales" USING btree ("_parent_id");
  CREATE INDEX "_publications_v_version_credits_locales_parent_id_idx" ON "_publications_v_version_credits_locales" USING btree ("_parent_id");
  CREATE INDEX "_publications_v_locales_parent_id_idx" ON "_publications_v_locales" USING btree ("_parent_id");
  CREATE INDEX "press_locales_parent_id_idx" ON "press_locales" USING btree ("_parent_id");
  CREATE INDEX "events_agenda_locales_parent_id_idx" ON "events_agenda_locales" USING btree ("_parent_id");
  CREATE INDEX "events_speakers_locales_parent_id_idx" ON "events_speakers_locales" USING btree ("_parent_id");
  CREATE INDEX "event_price_plans_locales_parent_id_idx" ON "event_price_plans_locales" USING btree ("_parent_id");
  CREATE INDEX "events_locales_parent_id_idx" ON "events_locales" USING btree ("_parent_id");
  CREATE INDEX "newsletters_locales_parent_id_idx" ON "newsletters_locales" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_locales_parent_id_idx" ON "_newsletters_v_locales" USING btree ("_parent_id");
  CREATE INDEX "spaces_locales_parent_id_idx" ON "spaces_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_locales_parent_id_idx" ON "forms_blocks_checkbox_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_country_locales_parent_id_idx" ON "forms_blocks_country_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_locales_parent_id_idx" ON "forms_blocks_email_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_message_locales_parent_id_idx" ON "forms_blocks_message_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_number_locales_parent_id_idx" ON "forms_blocks_number_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_options_locales_parent_id_idx" ON "forms_blocks_select_options_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_locales_parent_id_idx" ON "forms_blocks_select_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_state_locales_parent_id_idx" ON "forms_blocks_state_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_locales_parent_id_idx" ON "forms_blocks_text_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_locales_parent_id_idx" ON "forms_blocks_textarea_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_radio_options_locales_parent_id_idx" ON "forms_blocks_radio_options_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_radio_locales_parent_id_idx" ON "forms_blocks_radio_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_options_locales_parent_id_idx" ON "forms_blocks_checkbox_group_options_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_group_locales_parent_id_idx" ON "forms_blocks_checkbox_group_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_emails_locales_parent_id_idx" ON "forms_emails_locales" USING btree ("_parent_id");
  CREATE INDEX "forms_locales_parent_id_idx" ON "forms_locales" USING btree ("_parent_id");
  CREATE INDEX "site_settings_faq_locales_parent_id_idx" ON "site_settings_faq_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "exports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "exports_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "imports" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs_log" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_jobs" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "exports" CASCADE;
  DROP TABLE "exports_texts" CASCADE;
  DROP TABLE "imports" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP INDEX "people_locales_parent_id_idx";
  DROP INDEX "memberships_locales_parent_id_idx";
  DROP INDEX "course_price_plans_locales_parent_id_idx";
  DROP INDEX "courses_sessions_bibliography_locales_parent_id_idx";
  DROP INDEX "courses_sessions_activities_locales_parent_id_idx";
  DROP INDEX "courses_sessions_locales_parent_id_idx";
  DROP INDEX "courses_bibliography_locales_parent_id_idx";
  DROP INDEX "courses_locales_parent_id_idx";
  DROP INDEX "_course_price_plans_v_locales_parent_id_idx";
  DROP INDEX "_courses_v_version_sessions_bibliography_locales_parent__idx";
  DROP INDEX "_courses_v_version_sessions_activities_locales_parent_id_idx";
  DROP INDEX "_courses_v_version_sessions_locales_parent_id_idx";
  DROP INDEX "_courses_v_version_bibliography_locales_parent_id_idx";
  DROP INDEX "_courses_v_locales_parent_id_idx";
  DROP INDEX "enrollments_locales_parent_id_idx";
  DROP INDEX "programmes_highlights_locales_parent_id_idx";
  DROP INDEX "programmes_components_locales_parent_id_idx";
  DROP INDEX "programme_price_plans_locales_parent_id_idx";
  DROP INDEX "programmes_testimonials_locales_parent_id_idx";
  DROP INDEX "programmes_locales_parent_id_idx";
  DROP INDEX "_programmes_v_version_highlights_locales_parent_id_idx";
  DROP INDEX "_programmes_v_version_components_locales_parent_id_idx";
  DROP INDEX "_programme_price_plans_v_locales_parent_id_idx";
  DROP INDEX "_programmes_v_version_testimonials_locales_parent_id_idx";
  DROP INDEX "_programmes_v_locales_parent_id_idx";
  DROP INDEX "cycle_price_plans_locales_parent_id_idx";
  DROP INDEX "cycles_pricing_locales_parent_id_idx";
  DROP INDEX "cycles_locales_parent_id_idx";
  DROP INDEX "governance_locales_parent_id_idx";
  DROP INDEX "articles_credits_locales_parent_id_idx";
  DROP INDEX "articles_locales_parent_id_idx";
  DROP INDEX "_articles_v_version_credits_locales_parent_id_idx";
  DROP INDEX "_articles_v_locales_parent_id_idx";
  DROP INDEX "publications_credits_locales_parent_id_idx";
  DROP INDEX "publications_locales_parent_id_idx";
  DROP INDEX "_publications_v_version_credits_locales_parent_id_idx";
  DROP INDEX "_publications_v_locales_parent_id_idx";
  DROP INDEX "press_locales_parent_id_idx";
  DROP INDEX "events_agenda_locales_parent_id_idx";
  DROP INDEX "events_speakers_locales_parent_id_idx";
  DROP INDEX "event_price_plans_locales_parent_id_idx";
  DROP INDEX "events_locales_parent_id_idx";
  DROP INDEX "newsletters_locales_parent_id_idx";
  DROP INDEX "_newsletters_v_locales_parent_id_idx";
  DROP INDEX "spaces_locales_parent_id_idx";
  DROP INDEX "forms_blocks_checkbox_locales_parent_id_idx";
  DROP INDEX "forms_blocks_country_locales_parent_id_idx";
  DROP INDEX "forms_blocks_email_locales_parent_id_idx";
  DROP INDEX "forms_blocks_message_locales_parent_id_idx";
  DROP INDEX "forms_blocks_number_locales_parent_id_idx";
  DROP INDEX "forms_blocks_select_options_locales_parent_id_idx";
  DROP INDEX "forms_blocks_select_locales_parent_id_idx";
  DROP INDEX "forms_blocks_state_locales_parent_id_idx";
  DROP INDEX "forms_blocks_text_locales_parent_id_idx";
  DROP INDEX "forms_blocks_textarea_locales_parent_id_idx";
  DROP INDEX "forms_blocks_radio_options_locales_parent_id_idx";
  DROP INDEX "forms_blocks_radio_locales_parent_id_idx";
  DROP INDEX "forms_blocks_checkbox_group_options_locales_parent_id_idx";
  DROP INDEX "forms_blocks_checkbox_group_locales_parent_id_idx";
  DROP INDEX "forms_emails_locales_parent_id_idx";
  DROP INDEX "forms_locales_parent_id_idx";
  DROP INDEX "site_settings_faq_locales_parent_id_idx";
  DROP TYPE "public"."enum_exports_format";
  DROP TYPE "public"."enum_exports_sort_order";
  DROP TYPE "public"."enum_exports_locale";
  DROP TYPE "public"."enum_exports_drafts";
  DROP TYPE "public"."enum_imports_import_mode";
  DROP TYPE "public"."enum_imports_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
