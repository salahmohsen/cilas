import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_sessions_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum_sessions_activities_kind" AS ENUM('discussion', 'field_visit', 'exercise', 'screening', 'presentation', 'other');
  CREATE TYPE "public"."enum_sessions_delivery" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  CREATE TYPE "public"."enum__sessions_v_version_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum__sessions_v_version_activities_kind" AS ENUM('discussion', 'field_visit', 'exercise', 'screening', 'presentation', 'other');
  CREATE TYPE "public"."enum__sessions_v_version_delivery" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  CREATE TABLE "sessions_meetings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"start_time" varchar,
  	"end_time" varchar
  );
  
  CREATE TABLE "sessions_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_sessions_bibliography_type" NOT NULL,
  	"href" varchar
  );
  
  CREATE TABLE "sessions_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "sessions_activities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_sessions_activities_kind" NOT NULL
  );
  
  CREATE TABLE "sessions_activities_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "sessions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"course_id" integer NOT NULL,
  	"cancelled" boolean,
  	"delivery" "enum_sessions_delivery",
  	"position" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "sessions_locales" (
  	"title" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_sessions_v_version_meetings" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" varchar NOT NULL,
  	"start_time" varchar,
  	"end_time" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_sessions_v_version_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__sessions_v_version_bibliography_type" NOT NULL,
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_sessions_v_version_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_sessions_v_version_activities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum__sessions_v_version_activities_kind" NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_sessions_v_version_activities_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_sessions_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_course_id" integer NOT NULL,
  	"version_cancelled" boolean,
  	"version_delivery" "enum__sessions_v_version_delivery",
  	"version_position" numeric,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_sessions_v_locales" (
  	"version_title" varchar,
  	"version_description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "courses" ADD COLUMN "first_day" varchar;
  ALTER TABLE "courses" ADD COLUMN "last_day" varchar;
  ALTER TABLE "courses_locales" ADD COLUMN "timing_note" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_first_day" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_last_day" varchar;
  ALTER TABLE "_courses_v_locales" ADD COLUMN "version_timing_note" varchar;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "sessions_id" integer;
  ALTER TABLE "sessions_meetings" ADD CONSTRAINT "sessions_meetings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_bibliography" ADD CONSTRAINT "sessions_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_bibliography_locales" ADD CONSTRAINT "sessions_bibliography_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_activities" ADD CONSTRAINT "sessions_activities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions_activities_locales" ADD CONSTRAINT "sessions_activities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "sessions" ADD CONSTRAINT "sessions_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "sessions_locales" ADD CONSTRAINT "sessions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v_version_meetings" ADD CONSTRAINT "_sessions_v_version_meetings_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v_version_bibliography" ADD CONSTRAINT "_sessions_v_version_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v_version_bibliography_locales" ADD CONSTRAINT "_sessions_v_version_bibliography_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v_version_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v_version_activities" ADD CONSTRAINT "_sessions_v_version_activities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v_version_activities_locales" ADD CONSTRAINT "_sessions_v_version_activities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v_version_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_sessions_v" ADD CONSTRAINT "_sessions_v_parent_id_sessions_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sessions_v" ADD CONSTRAINT "_sessions_v_version_course_id_courses_id_fk" FOREIGN KEY ("version_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_sessions_v_locales" ADD CONSTRAINT "_sessions_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_sessions_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "sessions_meetings_order_idx" ON "sessions_meetings" USING btree ("_order");
  CREATE INDEX "sessions_meetings_parent_id_idx" ON "sessions_meetings" USING btree ("_parent_id");
  CREATE INDEX "sessions_meetings_date_idx" ON "sessions_meetings" USING btree ("date");
  CREATE INDEX "sessions_bibliography_order_idx" ON "sessions_bibliography" USING btree ("_order");
  CREATE INDEX "sessions_bibliography_parent_id_idx" ON "sessions_bibliography" USING btree ("_parent_id");
  CREATE INDEX "sessions_bibliography_title_idx" ON "sessions_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "sessions_bibliography_locales_locale_parent_id_unique" ON "sessions_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sessions_bibliography_locales_parent_id_idx" ON "sessions_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "sessions_activities_order_idx" ON "sessions_activities" USING btree ("_order");
  CREATE INDEX "sessions_activities_parent_id_idx" ON "sessions_activities" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "sessions_activities_locales_locale_parent_id_unique" ON "sessions_activities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sessions_activities_locales_parent_id_idx" ON "sessions_activities_locales" USING btree ("_parent_id");
  CREATE INDEX "sessions_course_idx" ON "sessions" USING btree ("course_id");
  CREATE INDEX "sessions_updated_at_idx" ON "sessions" USING btree ("updated_at");
  CREATE INDEX "sessions_created_at_idx" ON "sessions" USING btree ("created_at");
  CREATE UNIQUE INDEX "sessions_locales_locale_parent_id_unique" ON "sessions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "sessions_locales_parent_id_idx" ON "sessions_locales" USING btree ("_parent_id");
  CREATE INDEX "_sessions_v_version_meetings_order_idx" ON "_sessions_v_version_meetings" USING btree ("_order");
  CREATE INDEX "_sessions_v_version_meetings_parent_id_idx" ON "_sessions_v_version_meetings" USING btree ("_parent_id");
  CREATE INDEX "_sessions_v_version_meetings_date_idx" ON "_sessions_v_version_meetings" USING btree ("date");
  CREATE INDEX "_sessions_v_version_bibliography_order_idx" ON "_sessions_v_version_bibliography" USING btree ("_order");
  CREATE INDEX "_sessions_v_version_bibliography_parent_id_idx" ON "_sessions_v_version_bibliography" USING btree ("_parent_id");
  CREATE INDEX "_sessions_v_version_bibliography_title_idx" ON "_sessions_v_version_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "_sessions_v_version_bibliography_locales_locale_parent_id_un" ON "_sessions_v_version_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_sessions_v_version_bibliography_locales_parent_id_idx" ON "_sessions_v_version_bibliography_locales" USING btree ("_parent_id");
  CREATE INDEX "_sessions_v_version_activities_order_idx" ON "_sessions_v_version_activities" USING btree ("_order");
  CREATE INDEX "_sessions_v_version_activities_parent_id_idx" ON "_sessions_v_version_activities" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_sessions_v_version_activities_locales_locale_parent_id_uniq" ON "_sessions_v_version_activities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_sessions_v_version_activities_locales_parent_id_idx" ON "_sessions_v_version_activities_locales" USING btree ("_parent_id");
  CREATE INDEX "_sessions_v_parent_idx" ON "_sessions_v" USING btree ("parent_id");
  CREATE INDEX "_sessions_v_version_version_course_idx" ON "_sessions_v" USING btree ("version_course_id");
  CREATE INDEX "_sessions_v_version_version_updated_at_idx" ON "_sessions_v" USING btree ("version_updated_at");
  CREATE INDEX "_sessions_v_version_version_created_at_idx" ON "_sessions_v" USING btree ("version_created_at");
  CREATE INDEX "_sessions_v_created_at_idx" ON "_sessions_v" USING btree ("created_at");
  CREATE INDEX "_sessions_v_updated_at_idx" ON "_sessions_v" USING btree ("updated_at");
  CREATE UNIQUE INDEX "_sessions_v_locales_locale_parent_id_unique" ON "_sessions_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_sessions_v_locales_parent_id_idx" ON "_sessions_v_locales" USING btree ("_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_sessions_fk" FOREIGN KEY ("sessions_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "courses_first_day_idx" ON "courses" USING btree ("first_day");
  CREATE INDEX "courses_last_day_idx" ON "courses" USING btree ("last_day");
  CREATE INDEX "_courses_v_version_version_first_day_idx" ON "_courses_v" USING btree ("version_first_day");
  CREATE INDEX "_courses_v_version_version_last_day_idx" ON "_courses_v" USING btree ("version_last_day");
  CREATE INDEX "payload_locked_documents_rels_sessions_id_idx" ON "payload_locked_documents_rels" USING btree ("sessions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sessions_meetings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions_bibliography" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions_bibliography_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions_activities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions_activities_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "sessions_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_version_meetings" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_version_bibliography" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_version_bibliography_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_version_activities" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_version_activities_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_sessions_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "sessions_meetings" CASCADE;
  DROP TABLE "sessions_bibliography" CASCADE;
  DROP TABLE "sessions_bibliography_locales" CASCADE;
  DROP TABLE "sessions_activities" CASCADE;
  DROP TABLE "sessions_activities_locales" CASCADE;
  DROP TABLE "sessions" CASCADE;
  DROP TABLE "sessions_locales" CASCADE;
  DROP TABLE "_sessions_v_version_meetings" CASCADE;
  DROP TABLE "_sessions_v_version_bibliography" CASCADE;
  DROP TABLE "_sessions_v_version_bibliography_locales" CASCADE;
  DROP TABLE "_sessions_v_version_activities" CASCADE;
  DROP TABLE "_sessions_v_version_activities_locales" CASCADE;
  DROP TABLE "_sessions_v" CASCADE;
  DROP TABLE "_sessions_v_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_sessions_fk";
  
  DROP INDEX "courses_first_day_idx";
  DROP INDEX "courses_last_day_idx";
  DROP INDEX "_courses_v_version_version_first_day_idx";
  DROP INDEX "_courses_v_version_version_last_day_idx";
  DROP INDEX "payload_locked_documents_rels_sessions_id_idx";
  ALTER TABLE "courses" DROP COLUMN "first_day";
  ALTER TABLE "courses" DROP COLUMN "last_day";
  ALTER TABLE "courses_locales" DROP COLUMN "timing_note";
  ALTER TABLE "_courses_v" DROP COLUMN "version_first_day";
  ALTER TABLE "_courses_v" DROP COLUMN "version_last_day";
  ALTER TABLE "_courses_v_locales" DROP COLUMN "version_timing_note";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "sessions_id";
  DROP TYPE "public"."enum_sessions_bibliography_type";
  DROP TYPE "public"."enum_sessions_activities_kind";
  DROP TYPE "public"."enum_sessions_delivery";
  DROP TYPE "public"."enum__sessions_v_version_bibliography_type";
  DROP TYPE "public"."enum__sessions_v_version_activities_kind";
  DROP TYPE "public"."enum__sessions_v_version_delivery";`)
}
