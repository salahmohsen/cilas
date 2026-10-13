import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  -- Each press item takes its outlet from the partner it pointed at, before
  -- the partners tables go: name (per language), website and logo.
  ALTER TABLE "press" ADD COLUMN IF NOT EXISTS "outlet_url" varchar;
  ALTER TABLE "press" ADD COLUMN IF NOT EXISTS "outlet_logo_id" integer;
  ALTER TABLE "press_locales" ADD COLUMN IF NOT EXISTS "outlet_name" varchar;
  UPDATE "press" p SET "outlet_url" = pa."url", "outlet_logo_id" = pa."logo_id"
    FROM "partners" pa WHERE p."outlet_id" = pa."id";
  UPDATE "press_locales" pl SET "outlet_name" = pal."name"
    FROM "press" p JOIN "partners_locales" pal ON pal."_parent_id" = p."outlet_id"
    WHERE pl."_parent_id" = p."id" AND pl."_locale" = pal."_locale";
  INSERT INTO "press_locales" ("_locale", "_parent_id", "outlet_name")
    SELECT pal."_locale", p."id", pal."name"
    FROM "press" p JOIN "partners_locales" pal ON pal."_parent_id" = p."outlet_id"
    WHERE NOT EXISTS (SELECT 1 FROM "press_locales" pl WHERE pl."_parent_id" = p."id" AND pl."_locale" = pal."_locale");
  -- Relation rows for fields that go: featured courses, funders, partners.
  DELETE FROM "programmes_rels" WHERE "path" IN ('featured_courses', 'partners');
  DELETE FROM "_programmes_v_rels" WHERE "path" IN ('version.featured_courses', 'version.partners');
  DELETE FROM "publications_rels" WHERE "path" = 'funders';
  DELETE FROM "payload_locked_documents_rels" WHERE "partners_id" IS NOT NULL;

   CREATE TABLE "site_settings_faq" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "site_settings_faq_locales" (
  	"question" varchar NOT NULL,
  	"answer" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  ALTER TABLE "courses_schedule_slots_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_courses_v_version_schedule_slots_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programmes_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "programmes_faqs_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_programmes_v_version_faqs" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_programmes_v_version_faqs_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_schedule_slots_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "events_partners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners_kind" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "partners_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "courses_schedule_slots_locales" CASCADE;
  DROP TABLE "_courses_v_version_schedule_slots_locales" CASCADE;
  DROP TABLE "programmes_faqs" CASCADE;
  DROP TABLE "programmes_faqs_locales" CASCADE;
  DROP TABLE "_programmes_v_version_faqs" CASCADE;
  DROP TABLE "_programmes_v_version_faqs_locales" CASCADE;
  DROP TABLE "events_schedule_slots_locales" CASCADE;
  DROP TABLE "events_partners" CASCADE;
  DROP TABLE "partners_kind" CASCADE;
  DROP TABLE "partners" CASCADE;
  DROP TABLE "partners_locales" CASCADE;
  DROP TABLE "site_settings_locales" CASCADE;
  ALTER TABLE "media" DROP CONSTRAINT IF EXISTS "media_space_id_spaces_id_fk";
  
  ALTER TABLE "programmes_rels" DROP CONSTRAINT IF EXISTS "programmes_rels_courses_fk";
  
  ALTER TABLE "programmes_rels" DROP CONSTRAINT IF EXISTS "programmes_rels_partners_fk";
  
  ALTER TABLE "_programmes_v_rels" DROP CONSTRAINT IF EXISTS "_programmes_v_rels_courses_fk";
  
  ALTER TABLE "_programmes_v_rels" DROP CONSTRAINT IF EXISTS "_programmes_v_rels_partners_fk";
  
  ALTER TABLE "publications_rels" DROP CONSTRAINT IF EXISTS "publications_rels_partners_fk";
  
  ALTER TABLE "press" DROP CONSTRAINT IF EXISTS "press_outlet_id_partners_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_partners_fk";
  
  DROP INDEX IF EXISTS "media_space_idx";
  DROP INDEX IF EXISTS "programmes_rels_courses_id_idx";
  DROP INDEX IF EXISTS "programmes_rels_partners_id_idx";
  DROP INDEX IF EXISTS "_programmes_v_rels_courses_id_idx";
  DROP INDEX IF EXISTS "_programmes_v_rels_partners_id_idx";
  DROP INDEX IF EXISTS "publications_rels_partners_id_idx";
  DROP INDEX IF EXISTS "press_outlet_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_partners_id_idx";

  ALTER TABLE "site_settings_faq" ADD CONSTRAINT "site_settings_faq_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_faq_locales" ADD CONSTRAINT "site_settings_faq_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings_faq"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "site_settings_faq_order_idx" ON "site_settings_faq" USING btree ("_order");
  CREATE INDEX "site_settings_faq_parent_id_idx" ON "site_settings_faq" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_faq_locales_locale_parent_id_unique" ON "site_settings_faq_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "press" ADD CONSTRAINT "press_outlet_logo_id_media_id_fk" FOREIGN KEY ("outlet_logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "press_outlet_outlet_logo_idx" ON "press" USING btree ("outlet_logo_id");
  ALTER TABLE "people" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "memberships" DROP COLUMN IF EXISTS "note";
  ALTER TABLE "memberships" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "space_id";
  ALTER TABLE "media" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "course_price_plan_items" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "courses" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "courses_locales" DROP COLUMN IF EXISTS "registration_application_requirements";
  ALTER TABLE "_course_price_plan_items_v" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "_courses_v" DROP COLUMN IF EXISTS "version_import_status";
  ALTER TABLE "_courses_v_locales" DROP COLUMN IF EXISTS "version_registration_application_requirements";
  ALTER TABLE "programme_price_plan_items" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "programmes" DROP COLUMN IF EXISTS "self_directed_study";
  ALTER TABLE "programmes" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "programmes_locales" DROP COLUMN IF EXISTS "registration_application_requirements";
  ALTER TABLE "programmes_rels" DROP COLUMN IF EXISTS "courses_id";
  ALTER TABLE "programmes_rels" DROP COLUMN IF EXISTS "partners_id";
  ALTER TABLE "_programme_price_plan_items_v" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "_programmes_v" DROP COLUMN IF EXISTS "version_self_directed_study";
  ALTER TABLE "_programmes_v" DROP COLUMN IF EXISTS "version_import_status";
  ALTER TABLE "_programmes_v_locales" DROP COLUMN IF EXISTS "version_registration_application_requirements";
  ALTER TABLE "_programmes_v_rels" DROP COLUMN IF EXISTS "courses_id";
  ALTER TABLE "_programmes_v_rels" DROP COLUMN IF EXISTS "partners_id";
  ALTER TABLE "cycle_price_plan_items" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "cycles" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "cycles_locales" DROP COLUMN IF EXISTS "registration_application_requirements";
  ALTER TABLE "governance" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "articles" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "_articles_v" DROP COLUMN IF EXISTS "version_import_status";
  ALTER TABLE "publications" DROP COLUMN IF EXISTS "year_from";
  ALTER TABLE "publications" DROP COLUMN IF EXISTS "year_to";
  ALTER TABLE "publications" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "publications_rels" DROP COLUMN IF EXISTS "partners_id";
  ALTER TABLE "press_links" DROP COLUMN IF EXISTS "archived_url";
  ALTER TABLE "press" DROP COLUMN IF EXISTS "outlet_id";
  ALTER TABLE "press" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "event_price_plan_items" DROP COLUMN IF EXISTS "due_date";
  ALTER TABLE "events" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "events_locales" DROP COLUMN IF EXISTS "registration_application_requirements";
  ALTER TABLE "newsletters" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "_newsletters_v" DROP COLUMN IF EXISTS "version_import_status";
  ALTER TABLE "spaces" DROP COLUMN IF EXISTS "import_status";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "partners_id";
  ALTER TABLE "site_settings" DROP COLUMN IF EXISTS "site_title";
  DROP TYPE IF EXISTS "public"."enum_people_import_status";
  DROP TYPE IF EXISTS "public"."enum_memberships_import_status";
  DROP TYPE IF EXISTS "public"."enum_media_import_status";
  DROP TYPE IF EXISTS "public"."enum_courses_import_status";
  DROP TYPE IF EXISTS "public"."enum__courses_v_version_import_status";
  DROP TYPE IF EXISTS "public"."enum_programmes_import_status";
  DROP TYPE IF EXISTS "public"."enum__programmes_v_version_import_status";
  DROP TYPE IF EXISTS "public"."enum_cycles_import_status";
  DROP TYPE IF EXISTS "public"."enum_governance_import_status";
  DROP TYPE IF EXISTS "public"."enum_articles_import_status";
  DROP TYPE IF EXISTS "public"."enum__articles_v_version_import_status";
  DROP TYPE IF EXISTS "public"."enum_publications_import_status";
  DROP TYPE IF EXISTS "public"."enum_press_import_status";
  DROP TYPE IF EXISTS "public"."enum_events_partners_role";
  DROP TYPE IF EXISTS "public"."enum_events_import_status";
  DROP TYPE IF EXISTS "public"."enum_newsletters_import_status";
  DROP TYPE IF EXISTS "public"."enum__newsletters_v_version_import_status";
  DROP TYPE IF EXISTS "public"."enum_spaces_import_status";
  DROP TYPE IF EXISTS "public"."enum_partners_kind";
  DROP TYPE IF EXISTS "public"."enum_partners_import_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_people_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_memberships_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_media_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_courses_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__courses_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_programmes_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__programmes_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_cycles_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_governance_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_articles_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__articles_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_publications_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_press_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_events_partners_role" AS ENUM('sponsor', 'co_host', 'venue', 'other');
  CREATE TYPE "public"."enum_events_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_newsletters_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__newsletters_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_spaces_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_partners_kind" AS ENUM('funder', 'co_host', 'outlet', 'other');
  CREATE TYPE "public"."enum_partners_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TABLE "courses_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "programmes_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programmes_faqs_locales" (
  	"question" varchar,
  	"answer" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "_programmes_v_version_faqs" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programmes_v_version_faqs_locales" (
  	"question" varchar,
  	"answer" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "events_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "events_partners" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"partner_id" integer NOT NULL,
  	"role" "enum_events_partners_role"
  );
  
  CREATE TABLE "partners_kind" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_partners_kind",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "partners" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"url" varchar,
  	"logo_id" integer,
  	"legacy_url" varchar,
  	"import_status" "enum_partners_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "partners_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "site_settings_locales" (
  	"footer_text" jsonb,
  	"support_us" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "site_settings_faq" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "site_settings_faq_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "site_settings_faq" CASCADE;
  DROP TABLE "site_settings_faq_locales" CASCADE;
  ALTER TABLE "press" DROP CONSTRAINT "press_outlet_logo_id_media_id_fk";
  
  DROP INDEX "press_outlet_outlet_logo_idx";
  ALTER TABLE "people" ADD COLUMN "import_status" "enum_people_import_status";
  ALTER TABLE "memberships" ADD COLUMN "note" varchar;
  ALTER TABLE "memberships" ADD COLUMN "import_status" "enum_memberships_import_status";
  ALTER TABLE "media" ADD COLUMN "space_id" integer;
  ALTER TABLE "media" ADD COLUMN "import_status" "enum_media_import_status";
  ALTER TABLE "course_price_plan_items" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "courses" ADD COLUMN "import_status" "enum_courses_import_status";
  ALTER TABLE "courses_locales" ADD COLUMN "registration_application_requirements" jsonb;
  ALTER TABLE "_course_price_plan_items_v" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "_courses_v" ADD COLUMN "version_import_status" "enum__courses_v_version_import_status";
  ALTER TABLE "_courses_v_locales" ADD COLUMN "version_registration_application_requirements" jsonb;
  ALTER TABLE "programme_price_plan_items" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "programmes" ADD COLUMN "self_directed_study" boolean;
  ALTER TABLE "programmes" ADD COLUMN "import_status" "enum_programmes_import_status";
  ALTER TABLE "programmes_locales" ADD COLUMN "registration_application_requirements" jsonb;
  ALTER TABLE "programmes_rels" ADD COLUMN "courses_id" integer;
  ALTER TABLE "programmes_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "_programme_price_plan_items_v" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "_programmes_v" ADD COLUMN "version_self_directed_study" boolean;
  ALTER TABLE "_programmes_v" ADD COLUMN "version_import_status" "enum__programmes_v_version_import_status";
  ALTER TABLE "_programmes_v_locales" ADD COLUMN "version_registration_application_requirements" jsonb;
  ALTER TABLE "_programmes_v_rels" ADD COLUMN "courses_id" integer;
  ALTER TABLE "_programmes_v_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "cycle_price_plan_items" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "cycles" ADD COLUMN "import_status" "enum_cycles_import_status";
  ALTER TABLE "cycles_locales" ADD COLUMN "registration_application_requirements" jsonb;
  ALTER TABLE "governance" ADD COLUMN "import_status" "enum_governance_import_status";
  ALTER TABLE "articles" ADD COLUMN "import_status" "enum_articles_import_status";
  ALTER TABLE "_articles_v" ADD COLUMN "version_import_status" "enum__articles_v_version_import_status";
  ALTER TABLE "publications" ADD COLUMN "year_from" numeric;
  ALTER TABLE "publications" ADD COLUMN "year_to" numeric;
  ALTER TABLE "publications" ADD COLUMN "import_status" "enum_publications_import_status";
  ALTER TABLE "publications_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "press_links" ADD COLUMN "archived_url" varchar;
  ALTER TABLE "press" ADD COLUMN "outlet_id" integer;
  ALTER TABLE "press" ADD COLUMN "import_status" "enum_press_import_status";
  ALTER TABLE "event_price_plan_items" ADD COLUMN "due_date" timestamp(3) with time zone;
  ALTER TABLE "events" ADD COLUMN "import_status" "enum_events_import_status";
  ALTER TABLE "events_locales" ADD COLUMN "registration_application_requirements" jsonb;
  ALTER TABLE "newsletters" ADD COLUMN "import_status" "enum_newsletters_import_status";
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_import_status" "enum__newsletters_v_version_import_status";
  ALTER TABLE "spaces" ADD COLUMN "import_status" "enum_spaces_import_status";
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "partners_id" integer;
  ALTER TABLE "site_settings" ADD COLUMN "site_title" varchar;
  ALTER TABLE "courses_schedule_slots_locales" ADD CONSTRAINT "courses_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_schedule_slots_locales" ADD CONSTRAINT "_courses_v_version_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_faqs" ADD CONSTRAINT "programmes_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_faqs_locales" ADD CONSTRAINT "programmes_faqs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_faqs" ADD CONSTRAINT "_programmes_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_faqs_locales" ADD CONSTRAINT "_programmes_v_version_faqs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v_version_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_schedule_slots_locales" ADD CONSTRAINT "events_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_partners" ADD CONSTRAINT "events_partners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_partners" ADD CONSTRAINT "events_partners_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_kind" ADD CONSTRAINT "partners_kind_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partners_locales" ADD CONSTRAINT "partners_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "courses_schedule_slots_locales_locale_parent_id_unique" ON "courses_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "_courses_v_version_schedule_slots_locales_locale_parent_id_u" ON "_courses_v_version_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_faqs_order_idx" ON "programmes_faqs" USING btree ("_order");
  CREATE INDEX "programmes_faqs_parent_id_idx" ON "programmes_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programmes_faqs_locales_locale_parent_id_unique" ON "programmes_faqs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_version_faqs_order_idx" ON "_programmes_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_programmes_v_version_faqs_parent_id_idx" ON "_programmes_v_version_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_programmes_v_version_faqs_locales_locale_parent_id_unique" ON "_programmes_v_version_faqs_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "events_schedule_slots_locales_locale_parent_id_unique" ON "events_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_partners_order_idx" ON "events_partners" USING btree ("_order");
  CREATE INDEX "events_partners_parent_id_idx" ON "events_partners" USING btree ("_parent_id");
  CREATE INDEX "events_partners_partner_idx" ON "events_partners" USING btree ("partner_id");
  CREATE INDEX "partners_kind_order_idx" ON "partners_kind" USING btree ("order");
  CREATE INDEX "partners_kind_parent_idx" ON "partners_kind" USING btree ("parent_id");
  CREATE UNIQUE INDEX "partners_slug_idx" ON "partners" USING btree ("slug");
  CREATE INDEX "partners_logo_idx" ON "partners" USING btree ("logo_id");
  CREATE UNIQUE INDEX "partners_legacy_url_idx" ON "partners" USING btree ("legacy_url");
  CREATE INDEX "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "partners" USING btree ("created_at");
  CREATE UNIQUE INDEX "partners_locales_locale_parent_id_unique" ON "partners_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "site_settings_locales_locale_parent_id_unique" ON "site_settings_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "media" ADD CONSTRAINT "media_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "press" ADD CONSTRAINT "press_outlet_id_partners_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_space_idx" ON "media" USING btree ("space_id");
  CREATE INDEX "programmes_rels_courses_id_idx" ON "programmes_rels" USING btree ("courses_id");
  CREATE INDEX "programmes_rels_partners_id_idx" ON "programmes_rels" USING btree ("partners_id");
  CREATE INDEX "_programmes_v_rels_courses_id_idx" ON "_programmes_v_rels" USING btree ("courses_id");
  CREATE INDEX "_programmes_v_rels_partners_id_idx" ON "_programmes_v_rels" USING btree ("partners_id");
  CREATE INDEX "publications_rels_partners_id_idx" ON "publications_rels" USING btree ("partners_id");
  CREATE INDEX "press_outlet_idx" ON "press" USING btree ("outlet_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");
  ALTER TABLE "press" DROP COLUMN "outlet_url";
  ALTER TABLE "press" DROP COLUMN "outlet_logo_id";
  ALTER TABLE "press_locales" DROP COLUMN "outlet_name";`)
}
