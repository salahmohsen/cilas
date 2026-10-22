import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_spaces_kind" AS ENUM('community', 'cohort', 'course');
  CREATE TYPE "public"."enum_spaces_posting" AS ENUM('open', 'members_comment', 'fellows_only');
  CREATE TYPE "public"."enum_site_settings_spaces_mode" AS ENUM('off', 'trial', 'on');
  CREATE TABLE "spaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_spaces_kind" NOT NULL,
  	"course_id" integer,
  	"programme_id" integer,
  	"posting" "enum_spaces_posting" DEFAULT 'open',
  	"reopened" boolean DEFAULT false,
  	"introduction_post_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_comments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_files" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_reactions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_consents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_visits" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "space_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"programmes_id" integer
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "spaces_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_comments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_files_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_reactions_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_consents_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_visits_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_preferences_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "spaces_mode" "enum_site_settings_spaces_mode" DEFAULT 'off' NOT NULL;
  ALTER TABLE "site_settings" ADD COLUMN "spaces_trial_community" boolean DEFAULT false;
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "spaces" ADD CONSTRAINT "spaces_introduction_post_id_space_posts_id_fk" FOREIGN KEY ("introduction_post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_rels" ADD CONSTRAINT "site_settings_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "spaces_course_idx" ON "spaces" USING btree ("course_id");
  CREATE INDEX "spaces_programme_idx" ON "spaces" USING btree ("programme_id");
  CREATE INDEX "spaces_introduction_post_idx" ON "spaces" USING btree ("introduction_post_id");
  CREATE INDEX "spaces_updated_at_idx" ON "spaces" USING btree ("updated_at");
  CREATE INDEX "spaces_created_at_idx" ON "spaces" USING btree ("created_at");
  CREATE UNIQUE INDEX "course_idx" ON "spaces" USING btree ("course_id");
  CREATE UNIQUE INDEX "programme_idx" ON "spaces" USING btree ("programme_id");
  CREATE INDEX "space_posts_updated_at_idx" ON "space_posts" USING btree ("updated_at");
  CREATE INDEX "space_posts_created_at_idx" ON "space_posts" USING btree ("created_at");
  CREATE INDEX "space_comments_updated_at_idx" ON "space_comments" USING btree ("updated_at");
  CREATE INDEX "space_comments_created_at_idx" ON "space_comments" USING btree ("created_at");
  CREATE INDEX "space_files_updated_at_idx" ON "space_files" USING btree ("updated_at");
  CREATE INDEX "space_files_created_at_idx" ON "space_files" USING btree ("created_at");
  CREATE INDEX "space_reactions_updated_at_idx" ON "space_reactions" USING btree ("updated_at");
  CREATE INDEX "space_reactions_created_at_idx" ON "space_reactions" USING btree ("created_at");
  CREATE INDEX "space_consents_updated_at_idx" ON "space_consents" USING btree ("updated_at");
  CREATE INDEX "space_consents_created_at_idx" ON "space_consents" USING btree ("created_at");
  CREATE INDEX "space_visits_updated_at_idx" ON "space_visits" USING btree ("updated_at");
  CREATE INDEX "space_visits_created_at_idx" ON "space_visits" USING btree ("created_at");
  CREATE INDEX "space_preferences_updated_at_idx" ON "space_preferences" USING btree ("updated_at");
  CREATE INDEX "space_preferences_created_at_idx" ON "space_preferences" USING btree ("created_at");
  CREATE INDEX "site_settings_rels_order_idx" ON "site_settings_rels" USING btree ("order");
  CREATE INDEX "site_settings_rels_parent_idx" ON "site_settings_rels" USING btree ("parent_id");
  CREATE INDEX "site_settings_rels_path_idx" ON "site_settings_rels" USING btree ("path");
  CREATE INDEX "site_settings_rels_courses_id_idx" ON "site_settings_rels" USING btree ("courses_id");
  CREATE INDEX "site_settings_rels_programmes_id_idx" ON "site_settings_rels" USING btree ("programmes_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_spaces_fk" FOREIGN KEY ("spaces_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_posts_fk" FOREIGN KEY ("space_posts_id") REFERENCES "public"."space_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_comments_fk" FOREIGN KEY ("space_comments_id") REFERENCES "public"."space_comments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_files_fk" FOREIGN KEY ("space_files_id") REFERENCES "public"."space_files"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_reactions_fk" FOREIGN KEY ("space_reactions_id") REFERENCES "public"."space_reactions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_consents_fk" FOREIGN KEY ("space_consents_id") REFERENCES "public"."space_consents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_visits_fk" FOREIGN KEY ("space_visits_id") REFERENCES "public"."space_visits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_preferences_fk" FOREIGN KEY ("space_preferences_id") REFERENCES "public"."space_preferences"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_spaces_id_idx" ON "payload_locked_documents_rels" USING btree ("spaces_id");
  CREATE INDEX "payload_locked_documents_rels_space_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("space_posts_id");
  CREATE INDEX "payload_locked_documents_rels_space_comments_id_idx" ON "payload_locked_documents_rels" USING btree ("space_comments_id");
  CREATE INDEX "payload_locked_documents_rels_space_files_id_idx" ON "payload_locked_documents_rels" USING btree ("space_files_id");
  CREATE INDEX "payload_locked_documents_rels_space_reactions_id_idx" ON "payload_locked_documents_rels" USING btree ("space_reactions_id");
  CREATE INDEX "payload_locked_documents_rels_space_consents_id_idx" ON "payload_locked_documents_rels" USING btree ("space_consents_id");
  CREATE INDEX "payload_locked_documents_rels_space_visits_id_idx" ON "payload_locked_documents_rels" USING btree ("space_visits_id");
  CREATE INDEX "payload_locked_documents_rels_space_preferences_id_idx" ON "payload_locked_documents_rels" USING btree ("space_preferences_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_comments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_files" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_reactions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_consents" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_visits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_preferences" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "spaces" CASCADE;
  DROP TABLE "space_posts" CASCADE;
  DROP TABLE "space_comments" CASCADE;
  DROP TABLE "space_files" CASCADE;
  DROP TABLE "space_reactions" CASCADE;
  DROP TABLE "space_consents" CASCADE;
  DROP TABLE "space_visits" CASCADE;
  DROP TABLE "space_preferences" CASCADE;
  DROP TABLE "site_settings_rels" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_spaces_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_comments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_files_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_reactions_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_consents_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_visits_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_preferences_fk";
  
  DROP INDEX "payload_locked_documents_rels_spaces_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_comments_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_files_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_reactions_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_consents_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_visits_id_idx";
  DROP INDEX "payload_locked_documents_rels_space_preferences_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "spaces_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_comments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_files_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_reactions_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_consents_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_visits_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_preferences_id";
  ALTER TABLE "site_settings" DROP COLUMN "spaces_mode";
  ALTER TABLE "site_settings" DROP COLUMN "spaces_trial_community";
  DROP TYPE "public"."enum_spaces_kind";
  DROP TYPE "public"."enum_spaces_posting";
  DROP TYPE "public"."enum_site_settings_spaces_mode";`)
}
