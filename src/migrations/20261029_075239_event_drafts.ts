import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_events_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_version_schedule_slots_weekday" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum__events_v_version_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum__events_v_version_event_type" AS ENUM('talk', 'panel', 'book_discussion', 'reading_group', 'screening', 'performance', 'music', 'exhibition', 'open_day', 'workshop', 'residency', 'visit', 'other');
  CREATE TYPE "public"."enum__events_v_version_schedule_mode" AS ENUM('single', 'recurring');
  CREATE TYPE "public"."enum__events_v_version_schedule_start_precision" AS ENUM('day', 'week');
  CREATE TYPE "public"."enum__events_v_version_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum__events_v_version_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__events_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__events_v_published_locale" AS ENUM('en', 'ar');
  CREATE TABLE "_events_v_version_speakers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_speakers_locales" (
  	"role" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_events_v_version_schedule_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"weekday" "enum__events_v_version_schedule_slots_weekday",
  	"start_time" varchar,
  	"end_time" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_agenda" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"start_time" varchar,
  	"end_time" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_events_v_version_agenda_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_event_price_plan_items_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_event_price_plans_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_event_price_plans_v_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_events_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tier" "enum__events_v_version_tier" DEFAULT 'owner',
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_legacy_url" varchar,
  	"version_event_type" "enum__events_v_version_event_type",
  	"version_schedule_mode" "enum__events_v_version_schedule_mode" DEFAULT 'single',
  	"version_schedule_start_date" timestamp(3) with time zone,
  	"version_schedule_start_precision" "enum__events_v_version_schedule_start_precision" DEFAULT 'day',
  	"version_schedule_weeks" numeric,
  	"version_schedule_start_time" varchar,
  	"version_schedule_end_time" varchar,
  	"version_schedule_end_date" timestamp(3) with time zone,
  	"version_place_id" integer,
  	"version_external_venue_map_url" varchar,
  	"version_online_url" varchar,
  	"version_registration_method" "enum__events_v_version_registration_method",
  	"version_registration_form_id" integer,
  	"version_registration_url" varchar,
  	"version_registration_deadline" timestamp(3) with time zone,
  	"version_registration_archived_registration_url" varchar,
  	"version_pricing_min" numeric,
  	"version_pricing_max" numeric,
  	"version_pricing_currency" "enum__events_v_version_pricing_currency" DEFAULT 'EGP',
  	"version_pricing_need_based_deductions" boolean,
  	"version_series_id" integer,
  	"version_programme_id" integer,
  	"version_course_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__events_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__events_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_events_v_locales" (
  	"version_title" varchar,
  	"version_description" jsonb,
  	"version_schedule_note" varchar,
  	"version_external_venue_name" varchar,
  	"version_external_venue_address" varchar,
  	"version_pricing_note" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "events_agenda" ALTER COLUMN "start_time" DROP NOT NULL;
  ALTER TABLE "events_agenda" ALTER COLUMN "end_time" DROP NOT NULL;
  ALTER TABLE "events_agenda_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "events_speakers" ALTER COLUMN "person_id" DROP NOT NULL;
  ALTER TABLE "event_price_plan_items" ALTER COLUMN "amount" DROP NOT NULL;
  ALTER TABLE "event_price_plans_locales" ALTER COLUMN "label" DROP NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "tier" DROP NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "event_type" DROP NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "events_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "events" ADD COLUMN "_status" "enum_events_status" DEFAULT 'draft';
  ALTER TABLE "_events_v_version_speakers" ADD CONSTRAINT "_events_v_version_speakers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_version_speakers" ADD CONSTRAINT "_events_v_version_speakers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_speakers_locales" ADD CONSTRAINT "_events_v_version_speakers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v_version_speakers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_schedule_slots" ADD CONSTRAINT "_events_v_version_schedule_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_agenda" ADD CONSTRAINT "_events_v_version_agenda_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v_version_agenda_locales" ADD CONSTRAINT "_events_v_version_agenda_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v_version_agenda"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plan_items_v" ADD CONSTRAINT "_event_price_plan_items_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_event_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plans_v" ADD CONSTRAINT "_event_price_plans_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_event_price_plans_v_locales" ADD CONSTRAINT "_event_price_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_event_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_parent_id_events_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_place_id_places_id_fk" FOREIGN KEY ("version_place_id") REFERENCES "public"."places"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_registration_form_id_forms_id_fk" FOREIGN KEY ("version_registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_series_id_events_id_fk" FOREIGN KEY ("version_series_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_programme_id_programmes_id_fk" FOREIGN KEY ("version_programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v" ADD CONSTRAINT "_events_v_version_course_id_courses_id_fk" FOREIGN KEY ("version_course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_locales" ADD CONSTRAINT "_events_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_events_v_locales" ADD CONSTRAINT "_events_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_events_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_events_v_version_speakers_order_idx" ON "_events_v_version_speakers" USING btree ("_order");
  CREATE INDEX "_events_v_version_speakers_parent_id_idx" ON "_events_v_version_speakers" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_speakers_person_idx" ON "_events_v_version_speakers" USING btree ("person_id");
  CREATE UNIQUE INDEX "_events_v_version_speakers_locales_locale_parent_id_unique" ON "_events_v_version_speakers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_version_speakers_locales_parent_id_idx" ON "_events_v_version_speakers_locales" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_schedule_slots_order_idx" ON "_events_v_version_schedule_slots" USING btree ("_order");
  CREATE INDEX "_events_v_version_schedule_slots_parent_id_idx" ON "_events_v_version_schedule_slots" USING btree ("_parent_id");
  CREATE INDEX "_events_v_version_agenda_order_idx" ON "_events_v_version_agenda" USING btree ("_order");
  CREATE INDEX "_events_v_version_agenda_parent_id_idx" ON "_events_v_version_agenda" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_events_v_version_agenda_locales_locale_parent_id_unique" ON "_events_v_version_agenda_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_version_agenda_locales_parent_id_idx" ON "_events_v_version_agenda_locales" USING btree ("_parent_id");
  CREATE INDEX "_event_price_plan_items_v_order_idx" ON "_event_price_plan_items_v" USING btree ("_order");
  CREATE INDEX "_event_price_plan_items_v_parent_id_idx" ON "_event_price_plan_items_v" USING btree ("_parent_id");
  CREATE INDEX "_event_price_plans_v_order_idx" ON "_event_price_plans_v" USING btree ("_order");
  CREATE INDEX "_event_price_plans_v_parent_id_idx" ON "_event_price_plans_v" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_event_price_plans_v_locales_locale_parent_id_unique" ON "_event_price_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_event_price_plans_v_locales_parent_id_idx" ON "_event_price_plans_v_locales" USING btree ("_parent_id");
  CREATE INDEX "_events_v_parent_idx" ON "_events_v" USING btree ("parent_id");
  CREATE INDEX "_events_v_version_version_slug_idx" ON "_events_v" USING btree ("version_slug");
  CREATE INDEX "_events_v_version_version_cover_image_idx" ON "_events_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_events_v_version_version_legacy_url_idx" ON "_events_v" USING btree ("version_legacy_url");
  CREATE INDEX "_events_v_version_version_place_idx" ON "_events_v" USING btree ("version_place_id");
  CREATE INDEX "_events_v_version_registration_version_registration_form_idx" ON "_events_v" USING btree ("version_registration_form_id");
  CREATE INDEX "_events_v_version_version_series_idx" ON "_events_v" USING btree ("version_series_id");
  CREATE INDEX "_events_v_version_version_programme_idx" ON "_events_v" USING btree ("version_programme_id");
  CREATE INDEX "_events_v_version_version_course_idx" ON "_events_v" USING btree ("version_course_id");
  CREATE INDEX "_events_v_version_version_updated_at_idx" ON "_events_v" USING btree ("version_updated_at");
  CREATE INDEX "_events_v_version_version_created_at_idx" ON "_events_v" USING btree ("version_created_at");
  CREATE INDEX "_events_v_version_version__status_idx" ON "_events_v" USING btree ("version__status");
  CREATE INDEX "_events_v_created_at_idx" ON "_events_v" USING btree ("created_at");
  CREATE INDEX "_events_v_updated_at_idx" ON "_events_v" USING btree ("updated_at");
  CREATE INDEX "_events_v_snapshot_idx" ON "_events_v" USING btree ("snapshot");
  CREATE INDEX "_events_v_published_locale_idx" ON "_events_v" USING btree ("published_locale");
  CREATE INDEX "_events_v_latest_idx" ON "_events_v" USING btree ("latest");
  CREATE INDEX "_events_v_autosave_idx" ON "_events_v" USING btree ("autosave");
  CREATE INDEX "_events_v_version_meta_version_meta_image_idx" ON "_events_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_events_v_locales_locale_parent_id_unique" ON "_events_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_events_v_locales_parent_id_idx" ON "_events_v_locales" USING btree ("_parent_id");
  CREATE INDEX "events__status_idx" ON "events" USING btree ("_status");
  UPDATE events SET _status = 'published';`)

  const { rows } = await db.execute(sql`SELECT id FROM events ORDER BY id`)
  for (const row of rows) {
    const doc = await payload.db.findOne<{ id: number; createdAt: string; updatedAt: string }>({
      collection: 'events',
      locale: 'all',
      where: { id: { equals: row.id } },
      req,
    })
    if (!doc) throw new Error(`Event ${row.id} disappeared while backfilling versions`)
    await payload.db.createVersion({
      collectionSlug: 'events',
      parent: doc.id,
      autosave: false,
      createdAt: String(doc.createdAt),
      updatedAt: String(doc.updatedAt),
      versionData: doc,
      req,
    })
  }
}

export async function down({ db }: { db: Pick<MigrateDownArgs['db'], 'execute'> }): Promise<void> {
  await db.execute(sql`
    DO $$ BEGIN
      IF EXISTS (SELECT 1 FROM events WHERE _status IS DISTINCT FROM 'published') THEN
        RAISE EXCEPTION 'Cannot remove event drafts while unpublished events exist. Resolve them or restore the pre-upgrade snapshot.';
      END IF;
    END $$;
    CREATE SCHEMA IF NOT EXISTS cilas_migration_archive;
    CREATE TABLE IF NOT EXISTS cilas_migration_archive.event_versions_20261029 (
      saved_at timestamptz NOT NULL DEFAULT now(), source_table text NOT NULL, data jsonb NOT NULL
    );
  `)
  for (const table of [
    '_events_v',
    '_events_v_locales',
    '_events_v_version_speakers',
    '_events_v_version_speakers_locales',
    '_events_v_version_schedule_slots',
    '_events_v_version_agenda',
    '_events_v_version_agenda_locales',
    '_event_price_plans_v',
    '_event_price_plans_v_locales',
    '_event_price_plan_items_v',
  ]) {
    await db.execute(sql`INSERT INTO cilas_migration_archive.event_versions_20261029 (source_table, data)
      SELECT ${table}, to_jsonb(t) FROM ${sql.identifier(table)} t`)
  }
  await db.execute(sql`
   ALTER TABLE "_events_v_version_speakers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_speakers_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_schedule_slots" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_agenda" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_version_agenda_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_event_price_plan_items_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_event_price_plans_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_event_price_plans_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_events_v_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_events_v_version_speakers" CASCADE;
  DROP TABLE "_events_v_version_speakers_locales" CASCADE;
  DROP TABLE "_events_v_version_schedule_slots" CASCADE;
  DROP TABLE "_events_v_version_agenda" CASCADE;
  DROP TABLE "_events_v_version_agenda_locales" CASCADE;
  DROP TABLE "_event_price_plan_items_v" CASCADE;
  DROP TABLE "_event_price_plans_v" CASCADE;
  DROP TABLE "_event_price_plans_v_locales" CASCADE;
  DROP TABLE "_events_v" CASCADE;
  DROP TABLE "_events_v_locales" CASCADE;
  DROP INDEX "events__status_idx";
  ALTER TABLE "events_speakers" ALTER COLUMN "person_id" SET NOT NULL;
  ALTER TABLE "events_agenda" ALTER COLUMN "start_time" SET NOT NULL;
  ALTER TABLE "events_agenda" ALTER COLUMN "end_time" SET NOT NULL;
  ALTER TABLE "events_agenda_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "event_price_plan_items" ALTER COLUMN "amount" SET NOT NULL;
  ALTER TABLE "event_price_plans_locales" ALTER COLUMN "label" SET NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "tier" SET NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "events" ALTER COLUMN "event_type" SET NOT NULL;
  ALTER TABLE "events_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "events" DROP COLUMN "_status";
  DROP TYPE "public"."enum_events_status";
  DROP TYPE "public"."enum__events_v_version_schedule_slots_weekday";
  DROP TYPE "public"."enum__events_v_version_tier";
  DROP TYPE "public"."enum__events_v_version_event_type";
  DROP TYPE "public"."enum__events_v_version_schedule_mode";
  DROP TYPE "public"."enum__events_v_version_schedule_start_precision";
  DROP TYPE "public"."enum__events_v_version_registration_method";
  DROP TYPE "public"."enum__events_v_version_pricing_currency";
  DROP TYPE "public"."enum__events_v_version_status";
  DROP TYPE "public"."enum__events_v_published_locale";`)
}
