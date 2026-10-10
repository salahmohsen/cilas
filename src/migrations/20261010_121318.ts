import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_users_roles" AS ENUM('super_admin', 'admin', 'fellow', 'member', 'non_degree_seeking');
  CREATE TYPE "public"."enum_people_social_links_platform" AS ENUM('facebook', 'x', 'youtube', 'instagram', 'linkedin');
  CREATE TYPE "public"."enum_people_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_memberships_role" AS ENUM('student', 'residential_fellow', 'visiting_fellow');
  CREATE TYPE "public"."enum_memberships_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_courses_schedule_slots_weekday" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum_courses_sessions_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum_courses_sessions_activities_kind" AS ENUM('discussion', 'field_visit', 'exercise', 'screening', 'presentation', 'other');
  CREATE TYPE "public"."enum_courses_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum_courses_location" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  CREATE TYPE "public"."enum_courses_teaching_languages" AS ENUM('ar', 'en');
  CREATE TYPE "public"."enum_courses_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum_courses_course_type" AS ENUM('CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT');
  CREATE TYPE "public"."enum_courses_schedule_start_precision" AS ENUM('day', 'week');
  CREATE TYPE "public"."enum_courses_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum_courses_pricing_override_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_courses_session_unit" AS ENUM('session', 'week');
  CREATE TYPE "public"."enum_courses_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_courses_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__courses_v_version_schedule_slots_weekday" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum__courses_v_version_sessions_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum__courses_v_version_sessions_activities_kind" AS ENUM('discussion', 'field_visit', 'exercise', 'screening', 'presentation', 'other');
  CREATE TYPE "public"."enum__courses_v_version_bibliography_type" AS ENUM('reading', 'watch', 'listen', 'prompt', 'other');
  CREATE TYPE "public"."enum__courses_v_version_location" AS ENUM('OFFLINE', 'ONLINE', 'HYBRID');
  CREATE TYPE "public"."enum__courses_v_version_teaching_languages" AS ENUM('ar', 'en');
  CREATE TYPE "public"."enum__courses_v_version_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum__courses_v_version_course_type" AS ENUM('CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT');
  CREATE TYPE "public"."enum__courses_v_version_schedule_start_precision" AS ENUM('day', 'week');
  CREATE TYPE "public"."enum__courses_v_version_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum__courses_v_version_pricing_override_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__courses_v_version_session_unit" AS ENUM('session', 'week');
  CREATE TYPE "public"."enum__courses_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__courses_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__courses_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('applied', 'accepted', 'confirmed', 'completed', 'withdrawn');
  CREATE TYPE "public"."enum_enrollments_source" AS ENUM('registration_form', 'admin', 'backfill');
  CREATE TYPE "public"."enum_programmes_components_course_types" AS ENUM('CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT');
  CREATE TYPE "public"."enum_programmes_kind" AS ENUM('bridge', 'women_studies', 'residency');
  CREATE TYPE "public"."enum_programmes_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum_programmes_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_programmes_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_programmes_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__programmes_v_version_components_course_types" AS ENUM('CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT');
  CREATE TYPE "public"."enum__programmes_v_version_kind" AS ENUM('bridge', 'women_studies', 'residency');
  CREATE TYPE "public"."enum__programmes_v_version_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum__programmes_v_version_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__programmes_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__programmes_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__programmes_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_cycles_pricing_course_types" AS ENUM('CORE', 'THEMATIC', 'LAB', 'WORKSHOP', 'SHORT');
  CREATE TYPE "public"."enum_cycles_pricing_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_cycles_season" AS ENUM('fall', 'winter', 'spring', 'summer');
  CREATE TYPE "public"."enum_cycles_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum_cycles_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_governance_role" AS ENUM('advisor', 'trustee');
  CREATE TYPE "public"."enum_governance_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_articles_credits_role" AS ENUM('author', 'editor', 'translator', 'copy_editor', 'proofreader', 'supervisor', 'coordinator', 'art_director', 'cover_designer', 'illustrator', 'photographer', 'other');
  CREATE TYPE "public"."enum_articles_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum_articles_requested_tier" AS ENUM('community', 'public');
  CREATE TYPE "public"."enum_articles_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum_articles_translation_original_language" AS ENUM('ar', 'en', 'de', 'fr', 'other');
  CREATE TYPE "public"."enum_articles_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_articles_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_version_credits_role" AS ENUM('author', 'editor', 'translator', 'copy_editor', 'proofreader', 'supervisor', 'coordinator', 'art_director', 'cover_designer', 'illustrator', 'photographer', 'other');
  CREATE TYPE "public"."enum__articles_v_version_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum__articles_v_version_requested_tier" AS ENUM('community', 'public');
  CREATE TYPE "public"."enum__articles_v_version_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum__articles_v_version_translation_original_language" AS ENUM('ar', 'en', 'de', 'fr', 'other');
  CREATE TYPE "public"."enum__articles_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__articles_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__articles_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_publications_credits_role" AS ENUM('author', 'editor', 'translator', 'copy_editor', 'proofreader', 'supervisor', 'coordinator', 'art_director', 'cover_designer', 'illustrator', 'photographer', 'other');
  CREATE TYPE "public"."enum_publications_kind" AS ENUM('essay_collection', 'translation_booklet', 'research', 'other');
  CREATE TYPE "public"."enum_publications_license" AS ENUM('cc_by_nc_sa', 'cc_by_sa', 'cc_by', 'all_rights_reserved');
  CREATE TYPE "public"."enum_publications_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_press_links_language" AS ENUM('ar', 'en', 'de', 'fr', 'other');
  CREATE TYPE "public"."enum_press_kind" AS ENUM('coverage', 'interview', 'talk', 'op_ed');
  CREATE TYPE "public"."enum_press_language" AS ENUM('ar', 'en', 'de', 'fr', 'other');
  CREATE TYPE "public"."enum_press_date_precision" AS ENUM('day', 'month', 'year');
  CREATE TYPE "public"."enum_press_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_events_schedule_slots_weekday" AS ENUM('sat', 'sun', 'mon', 'tue', 'wed', 'thu', 'fri');
  CREATE TYPE "public"."enum_events_partners_role" AS ENUM('sponsor', 'co_host', 'venue', 'other');
  CREATE TYPE "public"."enum_events_tier" AS ENUM('owner', 'community', 'public');
  CREATE TYPE "public"."enum_events_event_type" AS ENUM('talk', 'panel', 'book_discussion', 'reading_group', 'screening', 'performance', 'music', 'exhibition', 'open_day', 'workshop', 'residency', 'visit', 'other');
  CREATE TYPE "public"."enum_events_schedule_start_precision" AS ENUM('day', 'week');
  CREATE TYPE "public"."enum_events_registration_method" AS ENUM('form', 'external', 'closed');
  CREATE TYPE "public"."enum_events_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_events_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_newsletters_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_newsletters_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__newsletters_v_version_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum__newsletters_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__newsletters_v_published_locale" AS ENUM('en', 'ar');
  CREATE TYPE "public"."enum_spaces_state" AS ENUM('current', 'former');
  CREATE TYPE "public"."enum_spaces_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_partners_kind" AS ENUM('funder', 'co_host', 'outlet', 'other');
  CREATE TYPE "public"."enum_partners_import_status" AS ENUM('needs_review', 'reviewed');
  CREATE TYPE "public"."enum_forms_confirmation_type" AS ENUM('message', 'redirect');
  CREATE TYPE "public"."enum_redirects_to_type" AS ENUM('reference', 'custom');
  CREATE TYPE "public"."enum_redirects_type" AS ENUM('301', '302');
  CREATE TYPE "public"."enum_site_settings_social_links_platform" AS ENUM('facebook', 'twitter', 'youtube', 'instagram');
  CREATE TABLE "users_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_users_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "people_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_people_social_links_platform" NOT NULL,
  	"url" varchar NOT NULL
  );
  
  CREATE TABLE "people" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"photo_id" integer,
  	"website" varchar,
  	"legacy_url" varchar,
  	"import_status" "enum_people_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "people_locales" (
  	"name" varchar NOT NULL,
  	"bio" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "memberships" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer NOT NULL,
  	"programme_id" integer NOT NULL,
  	"role" "enum_memberships_role" DEFAULT 'student' NOT NULL,
  	"note" varchar,
  	"legacy_url" varchar,
  	"import_status" "enum_memberships_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "memberships_locales" (
  	"title" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"space_id" integer,
  	"prefix" varchar DEFAULT 'media',
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
  	"focal_y" numeric,
  	"sizes_thumbnail_url" varchar,
  	"sizes_thumbnail_width" numeric,
  	"sizes_thumbnail_height" numeric,
  	"sizes_thumbnail_mime_type" varchar,
  	"sizes_thumbnail_filesize" numeric,
  	"sizes_thumbnail_filename" varchar,
  	"sizes_card_url" varchar,
  	"sizes_card_width" numeric,
  	"sizes_card_height" numeric,
  	"sizes_card_mime_type" varchar,
  	"sizes_card_filesize" numeric,
  	"sizes_card_filename" varchar
  );
  
  CREATE TABLE "courses_schedule_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"weekday" "enum_courses_schedule_slots_weekday",
  	"start_time" varchar,
  	"end_time" varchar
  );
  
  CREATE TABLE "courses_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "course_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"due_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "course_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "course_price_plans_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_sessions_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"start_time" varchar,
  	"end_time" varchar
  );
  
  CREATE TABLE "courses_sessions_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_courses_sessions_bibliography_type",
  	"href" varchar
  );
  
  CREATE TABLE "courses_sessions_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_sessions_activities" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"kind" "enum_courses_sessions_activities_kind"
  );
  
  CREATE TABLE "courses_sessions_activities_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"order" numeric,
  	"meetings" numeric,
  	"cancelled" boolean
  );
  
  CREATE TABLE "courses_sessions_locales" (
  	"session_title" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"type" "enum_courses_bibliography_type",
  	"href" varchar
  );
  
  CREATE TABLE "courses_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "courses_location" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_courses_location",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "courses_teaching_languages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_courses_teaching_languages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "courses" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tier" "enum_courses_tier" DEFAULT 'owner',
  	"course_type" "enum_courses_course_type",
  	"cycle_id" integer,
  	"cover_image_id" integer,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"schedule_start_date" timestamp(3) with time zone,
  	"schedule_start_precision" "enum_courses_schedule_start_precision" DEFAULT 'day',
  	"schedule_weeks" numeric,
  	"schedule_end_date" timestamp(3) with time zone,
  	"registration_method" "enum_courses_registration_method",
  	"registration_form_id" integer,
  	"registration_url" varchar,
  	"registration_deadline" timestamp(3) with time zone,
  	"registration_archived_registration_url" varchar,
  	"pricing_override_min" numeric,
  	"pricing_override_max" numeric,
  	"pricing_override_currency" "enum_courses_pricing_override_currency" DEFAULT 'EGP',
  	"pricing_override_need_based_deductions" boolean,
  	"syllabus_tentative" boolean,
  	"session_unit" "enum_courses_session_unit" DEFAULT 'session',
  	"legacy_url" varchar,
  	"import_status" "enum_courses_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_courses_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "courses_locales" (
  	"title" varchar,
  	"subtitle" varchar,
  	"summary" varchar,
  	"epigraph" varchar,
  	"description" jsonb,
  	"facilitator_note" varchar,
  	"content_warning" varchar,
  	"schedule_note" varchar,
  	"registration_application_requirements" jsonb,
  	"pricing_override_note" varchar,
  	"language_note" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "courses_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer
  );
  
  CREATE TABLE "_courses_v_version_schedule_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"weekday" "enum__courses_v_version_schedule_slots_weekday",
  	"start_time" varchar,
  	"end_time" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_course_price_plan_items_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"due_date" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_course_price_plans_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_course_price_plans_v_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_sessions_dates" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"date" timestamp(3) with time zone,
  	"start_time" varchar,
  	"end_time" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_sessions_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__courses_v_version_sessions_bibliography_type",
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_sessions_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_sessions_activities" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum__courses_v_version_sessions_activities_kind",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_sessions_activities_locales" (
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" numeric,
  	"meetings" numeric,
  	"cancelled" boolean,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_sessions_locales" (
  	"session_title" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_bibliography" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum__courses_v_version_bibliography_type",
  	"href" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_courses_v_version_bibliography_locales" (
  	"title" varchar,
  	"note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_location" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__courses_v_version_location",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_courses_v_version_teaching_languages" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__courses_v_version_teaching_languages",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_courses_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_tier" "enum__courses_v_version_tier" DEFAULT 'owner',
  	"version_course_type" "enum__courses_v_version_course_type",
  	"version_cycle_id" integer,
  	"version_cover_image_id" integer,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_schedule_start_date" timestamp(3) with time zone,
  	"version_schedule_start_precision" "enum__courses_v_version_schedule_start_precision" DEFAULT 'day',
  	"version_schedule_weeks" numeric,
  	"version_schedule_end_date" timestamp(3) with time zone,
  	"version_registration_method" "enum__courses_v_version_registration_method",
  	"version_registration_form_id" integer,
  	"version_registration_url" varchar,
  	"version_registration_deadline" timestamp(3) with time zone,
  	"version_registration_archived_registration_url" varchar,
  	"version_pricing_override_min" numeric,
  	"version_pricing_override_max" numeric,
  	"version_pricing_override_currency" "enum__courses_v_version_pricing_override_currency" DEFAULT 'EGP',
  	"version_pricing_override_need_based_deductions" boolean,
  	"version_syllabus_tentative" boolean,
  	"version_session_unit" "enum__courses_v_version_session_unit" DEFAULT 'session',
  	"version_legacy_url" varchar,
  	"version_import_status" "enum__courses_v_version_import_status",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__courses_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__courses_v_published_locale",
  	"latest" boolean,
  	"autosave" boolean
  );
  
  CREATE TABLE "_courses_v_locales" (
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_summary" varchar,
  	"version_epigraph" varchar,
  	"version_description" jsonb,
  	"version_facilitator_note" varchar,
  	"version_content_warning" varchar,
  	"version_schedule_note" varchar,
  	"version_registration_application_requirements" jsonb,
  	"version_pricing_override_note" varchar,
  	"version_language_note" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_courses_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer
  );
  
  CREATE TABLE "enrollments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer NOT NULL,
  	"course_id" integer NOT NULL,
  	"status" "enum_enrollments_status" DEFAULT 'applied' NOT NULL,
  	"slot" varchar,
  	"source" "enum_enrollments_source" DEFAULT 'admin' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "enrollments_locales" (
  	"assessment" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "programmes_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programmes_highlights_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "programmes_components_course_types" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_programmes_components_course_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programmes_components" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"cycle_id" integer
  );
  
  CREATE TABLE "programmes_components_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "programme_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"due_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "programme_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "programme_price_plans_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "programmes_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" integer
  );
  
  CREATE TABLE "programmes_testimonials_locales" (
  	"quote" varchar,
  	"attribution" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
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
  
  CREATE TABLE "programmes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_programmes_kind",
  	"cover_id" integer,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"self_directed_study" boolean,
  	"capacity" numeric,
  	"weekly_hours" numeric,
  	"registration_method" "enum_programmes_registration_method",
  	"registration_form_id" integer,
  	"registration_url" varchar,
  	"registration_deadline" timestamp(3) with time zone,
  	"registration_archived_registration_url" varchar,
  	"pricing_min" numeric,
  	"pricing_max" numeric,
  	"pricing_currency" "enum_programmes_pricing_currency" DEFAULT 'EGP',
  	"pricing_need_based_deductions" boolean,
  	"legacy_url" varchar,
  	"import_status" "enum_programmes_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_programmes_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "programmes_locales" (
  	"title" varchar,
  	"tagline" varchar,
  	"overview" jsonb,
  	"schedule_note" varchar,
  	"requirements" jsonb,
  	"registration_application_requirements" jsonb,
  	"pricing_note" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "programmes_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cycles_id" integer,
  	"courses_id" integer,
  	"partners_id" integer
  );
  
  CREATE TABLE "_programmes_v_version_highlights" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programmes_v_version_highlights_locales" (
  	"text" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_programmes_v_version_components_course_types" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum__programmes_v_version_components_course_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "_programmes_v_version_components" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programmes_v_version_components_locales" (
  	"label" varchar,
  	"description" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_programme_price_plan_items_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"amount" numeric,
  	"due_date" timestamp(3) with time zone,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programme_price_plans_v" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programme_price_plans_v_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_programmes_v_version_testimonials" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_programmes_v_version_testimonials_locales" (
  	"quote" varchar,
  	"attribution" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
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
  
  CREATE TABLE "_programmes_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_kind" "enum__programmes_v_version_kind",
  	"version_cover_id" integer,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_self_directed_study" boolean,
  	"version_capacity" numeric,
  	"version_weekly_hours" numeric,
  	"version_registration_method" "enum__programmes_v_version_registration_method",
  	"version_registration_form_id" integer,
  	"version_registration_url" varchar,
  	"version_registration_deadline" timestamp(3) with time zone,
  	"version_registration_archived_registration_url" varchar,
  	"version_pricing_min" numeric,
  	"version_pricing_max" numeric,
  	"version_pricing_currency" "enum__programmes_v_version_pricing_currency" DEFAULT 'EGP',
  	"version_pricing_need_based_deductions" boolean,
  	"version_legacy_url" varchar,
  	"version_import_status" "enum__programmes_v_version_import_status",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__programmes_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__programmes_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_programmes_v_locales" (
  	"version_title" varchar,
  	"version_tagline" varchar,
  	"version_overview" jsonb,
  	"version_schedule_note" varchar,
  	"version_requirements" jsonb,
  	"version_registration_application_requirements" jsonb,
  	"version_pricing_note" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_programmes_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"cycles_id" integer,
  	"courses_id" integer,
  	"partners_id" integer
  );
  
  CREATE TABLE "cycles_pricing_course_types" (
  	"order" integer NOT NULL,
  	"parent_id" varchar NOT NULL,
  	"value" "enum_cycles_pricing_course_types",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cycle_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"due_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "cycle_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "cycle_price_plans_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "cycles_pricing" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"pricing_min" numeric,
  	"pricing_max" numeric,
  	"pricing_currency" "enum_cycles_pricing_pricing_currency" DEFAULT 'EGP',
  	"pricing_need_based_deductions" boolean
  );
  
  CREATE TABLE "cycles_pricing_locales" (
  	"pricing_note" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "cycles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar,
  	"slug" varchar,
  	"season" "enum_cycles_season" NOT NULL,
  	"start_year" numeric NOT NULL,
  	"space_id" integer NOT NULL,
  	"start_date" timestamp(3) with time zone,
  	"academic_year" varchar,
  	"registration_method" "enum_cycles_registration_method",
  	"registration_form_id" integer,
  	"registration_url" varchar,
  	"registration_deadline" timestamp(3) with time zone,
  	"registration_archived_registration_url" varchar,
  	"legacy_url" varchar,
  	"import_status" "enum_cycles_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "cycles_locales" (
  	"registration_application_requirements" jsonb,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "governance" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"person_id" integer NOT NULL,
  	"role" "enum_governance_role" NOT NULL,
  	"board_role" varchar,
  	"term_from" numeric,
  	"term_to" numeric,
  	"order" numeric,
  	"legacy_url" varchar,
  	"import_status" "enum_governance_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "governance_locales" (
  	"title" varchar,
  	"advises_on" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "articles_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_articles_credits_role"
  );
  
  CREATE TABLE "articles_credits_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "articles_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"tag" varchar
  );
  
  CREATE TABLE "articles" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"cover_image_id" integer,
  	"review_status" "enum_articles_review_status" DEFAULT 'draft',
  	"review_review_note" varchar,
  	"requested_tier" "enum_articles_requested_tier" DEFAULT 'community',
  	"tier" "enum_articles_tier" DEFAULT 'owner',
  	"published_date" timestamp(3) with time zone,
  	"featured" boolean,
  	"translation_original_language" "enum_articles_translation_original_language",
  	"translation_original_title" varchar,
  	"translation_original_url" varchar,
  	"translation_original_source" varchar,
  	"legacy_url" varchar,
  	"import_status" "enum_articles_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_articles_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "articles_locales" (
  	"title" varchar,
  	"body" jsonb,
  	"translation_note" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "articles_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "_articles_v_version_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum__articles_v_version_credits_role",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v_version_credits_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_articles_v_version_tags" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"tag" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_articles_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_cover_image_id" integer,
  	"version_review_status" "enum__articles_v_version_review_status" DEFAULT 'draft',
  	"version_review_review_note" varchar,
  	"version_requested_tier" "enum__articles_v_version_requested_tier" DEFAULT 'community',
  	"version_tier" "enum__articles_v_version_tier" DEFAULT 'owner',
  	"version_published_date" timestamp(3) with time zone,
  	"version_featured" boolean,
  	"version_translation_original_language" "enum__articles_v_version_translation_original_language",
  	"version_translation_original_title" varchar,
  	"version_translation_original_url" varchar,
  	"version_translation_original_source" varchar,
  	"version_legacy_url" varchar,
  	"version_import_status" "enum__articles_v_version_import_status",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__articles_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__articles_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_articles_v_locales" (
  	"version_title" varchar,
  	"version_body" jsonb,
  	"version_translation_note" varchar,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_articles_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer,
  	"articles_id" integer
  );
  
  CREATE TABLE "publications_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"role" "enum_publications_credits_role" NOT NULL
  );
  
  CREATE TABLE "publications_credits_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "publications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_publications_kind" NOT NULL,
  	"cover_image_id" integer,
  	"year_from" numeric,
  	"year_to" numeric,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"foreword_id" integer,
  	"license" "enum_publications_license",
  	"print_edition_url" varchar,
  	"legacy_url" varchar,
  	"import_status" "enum_publications_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "publications_locales" (
  	"title" varchar NOT NULL,
  	"subtitle" varchar,
  	"intro" jsonb,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "publications_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"articles_id" integer,
  	"people_id" integer,
  	"courses_id" integer,
  	"partners_id" integer
  );
  
  CREATE TABLE "press_authors" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" integer,
  	"name" varchar
  );
  
  CREATE TABLE "press_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"language" "enum_press_links_language",
  	"url" varchar NOT NULL,
  	"archived_url" varchar
  );
  
  CREATE TABLE "press" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"kind" "enum_press_kind" DEFAULT 'coverage' NOT NULL,
  	"title" varchar NOT NULL,
  	"language" "enum_press_language",
  	"outlet_id" integer,
  	"published_date" timestamp(3) with time zone,
  	"date_precision" "enum_press_date_precision" DEFAULT 'day',
  	"legacy_url" varchar,
  	"import_status" "enum_press_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "press_locales" (
  	"excerpt" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "events_schedule_slots" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"weekday" "enum_events_schedule_slots_weekday" NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL
  );
  
  CREATE TABLE "events_schedule_slots_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "events_agenda" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"start_time" varchar NOT NULL,
  	"end_time" varchar NOT NULL
  );
  
  CREATE TABLE "events_agenda_locales" (
  	"title" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "events_speakers" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"person_id" integer NOT NULL
  );
  
  CREATE TABLE "events_speakers_locales" (
  	"role" varchar,
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
  
  CREATE TABLE "event_price_plan_items" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"amount" numeric NOT NULL,
  	"due_date" timestamp(3) with time zone
  );
  
  CREATE TABLE "event_price_plans" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "event_price_plans_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"tier" "enum_events_tier" DEFAULT 'owner' NOT NULL,
  	"event_type" "enum_events_event_type" NOT NULL,
  	"series_id" integer,
  	"programme_id" integer,
  	"course_id" integer,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"schedule_start_date" timestamp(3) with time zone,
  	"schedule_start_precision" "enum_events_schedule_start_precision" DEFAULT 'day',
  	"schedule_weeks" numeric,
  	"schedule_end_date" timestamp(3) with time zone,
  	"space_id" integer,
  	"external_venue_map_url" varchar,
  	"online_url" varchar,
  	"registration_method" "enum_events_registration_method",
  	"registration_form_id" integer,
  	"registration_url" varchar,
  	"registration_deadline" timestamp(3) with time zone,
  	"registration_archived_registration_url" varchar,
  	"pricing_min" numeric,
  	"pricing_max" numeric,
  	"pricing_currency" "enum_events_pricing_currency" DEFAULT 'EGP',
  	"pricing_need_based_deductions" boolean,
  	"legacy_url" varchar,
  	"import_status" "enum_events_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "events_locales" (
  	"title" varchar NOT NULL,
  	"description" jsonb,
  	"schedule_note" varchar,
  	"external_venue_name" varchar,
  	"external_venue_address" varchar,
  	"registration_application_requirements" jsonb,
  	"pricing_note" varchar,
  	"meta_title" varchar,
  	"meta_description" varchar,
  	"meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "newsletters" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar,
  	"issue_date" timestamp(3) with time zone,
  	"cover_image_id" integer,
  	"legacy_url" varchar,
  	"import_status" "enum_newsletters_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_newsletters_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "newsletters_locales" (
  	"title" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_newsletters_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_issue_date" timestamp(3) with time zone,
  	"version_cover_image_id" integer,
  	"version_legacy_url" varchar,
  	"version_import_status" "enum__newsletters_v_version_import_status",
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__newsletters_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__newsletters_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_newsletters_v_locales" (
  	"version_title" varchar,
  	"version_body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "spaces_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer
  );
  
  CREATE TABLE "spaces" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"generate_slug" boolean DEFAULT true,
  	"slug" varchar NOT NULL,
  	"state" "enum_spaces_state",
  	"opened_year" numeric,
  	"closed_year" numeric,
  	"legacy_url" varchar,
  	"import_status" "enum_spaces_import_status",
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "spaces_locales" (
  	"city" varchar,
  	"description" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
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
  
  CREATE TABLE "forms_blocks_checkbox" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"default_value" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_checkbox_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_country" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_country_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_email" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_email_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_message" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_message_locales" (
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_number" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"default_value" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_number_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select_options_locales" (
  	"label" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_select" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"placeholder" varchar,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_select_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_state" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_state_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_text" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_text_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_blocks_textarea" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"_path" text NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"width" numeric,
  	"required" boolean,
  	"block_name" varchar
  );
  
  CREATE TABLE "forms_blocks_textarea_locales" (
  	"label" varchar,
  	"default_value" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms_emails" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"email_to" varchar,
  	"cc" varchar,
  	"bcc" varchar,
  	"reply_to" varchar,
  	"email_from" varchar
  );
  
  CREATE TABLE "forms_emails_locales" (
  	"subject" varchar DEFAULT 'You''ve received a new message.' NOT NULL,
  	"message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" varchar NOT NULL
  );
  
  CREATE TABLE "forms" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"confirmation_type" "enum_forms_confirmation_type" DEFAULT 'message',
  	"redirect_url" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "forms_locales" (
  	"submit_button_label" varchar,
  	"confirmation_message" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "form_submissions_submission_data" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"field" varchar NOT NULL,
  	"value" varchar NOT NULL
  );
  
  CREATE TABLE "form_submissions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"form_id" integer NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redirects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"from" varchar NOT NULL,
  	"to_type" "enum_redirects_to_type" DEFAULT 'reference',
  	"to_url" varchar,
  	"type" "enum_redirects_type" DEFAULT '301' NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "redirects_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"cycles_id" integer,
  	"programmes_id" integer,
  	"publications_id" integer,
  	"articles_id" integer,
  	"events_id" integer,
  	"press_id" integer,
  	"people_id" integer
  );
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"people_id" integer,
  	"memberships_id" integer,
  	"media_id" integer,
  	"courses_id" integer,
  	"enrollments_id" integer,
  	"programmes_id" integer,
  	"cycles_id" integer,
  	"governance_id" integer,
  	"articles_id" integer,
  	"publications_id" integer,
  	"press_id" integer,
  	"events_id" integer,
  	"newsletters_id" integer,
  	"spaces_id" integer,
  	"partners_id" integer,
  	"forms_id" integer,
  	"form_submissions_id" integer,
  	"redirects_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "site_settings_social_links" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"platform" "enum_site_settings_social_links_platform",
  	"url" varchar
  );
  
  CREATE TABLE "site_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"site_title" varchar,
  	"contact_emails_admissions" varchar,
  	"contact_emails_info" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "site_settings_locales" (
  	"footer_text" jsonb,
  	"support_us" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "users_roles" ADD CONSTRAINT "users_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "users" ADD CONSTRAINT "users_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people_social_links" ADD CONSTRAINT "people_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "people" ADD CONSTRAINT "people_photo_id_media_id_fk" FOREIGN KEY ("photo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "people_locales" ADD CONSTRAINT "people_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships" ADD CONSTRAINT "memberships_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "memberships_locales" ADD CONSTRAINT "memberships_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_schedule_slots" ADD CONSTRAINT "courses_schedule_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_schedule_slots_locales" ADD CONSTRAINT "courses_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_price_plan_items" ADD CONSTRAINT "course_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_price_plans" ADD CONSTRAINT "course_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "course_price_plans_locales" ADD CONSTRAINT "course_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."course_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_dates" ADD CONSTRAINT "courses_sessions_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_bibliography" ADD CONSTRAINT "courses_sessions_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_bibliography_locales" ADD CONSTRAINT "courses_sessions_bibliography_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_activities" ADD CONSTRAINT "courses_sessions_activities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_activities_locales" ADD CONSTRAINT "courses_sessions_activities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions" ADD CONSTRAINT "courses_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_sessions_locales" ADD CONSTRAINT "courses_sessions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_bibliography" ADD CONSTRAINT "courses_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_bibliography_locales" ADD CONSTRAINT "courses_bibliography_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_location" ADD CONSTRAINT "courses_location_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_teaching_languages" ADD CONSTRAINT "courses_teaching_languages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses" ADD CONSTRAINT "courses_registration_form_id_forms_id_fk" FOREIGN KEY ("registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_locales" ADD CONSTRAINT "courses_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "courses_locales" ADD CONSTRAINT "courses_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "courses_rels" ADD CONSTRAINT "courses_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_schedule_slots" ADD CONSTRAINT "_courses_v_version_schedule_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_schedule_slots_locales" ADD CONSTRAINT "_courses_v_version_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plan_items_v" ADD CONSTRAINT "_course_price_plan_items_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_course_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plans_v" ADD CONSTRAINT "_course_price_plans_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_course_price_plans_v_locales" ADD CONSTRAINT "_course_price_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_course_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_dates" ADD CONSTRAINT "_courses_v_version_sessions_dates_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_bibliography" ADD CONSTRAINT "_courses_v_version_sessions_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_bibliography_locales" ADD CONSTRAINT "_courses_v_version_sessions_bibliography_locales_parent_i_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_activities" ADD CONSTRAINT "_courses_v_version_sessions_activities_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_activities_locales" ADD CONSTRAINT "_courses_v_version_sessions_activities_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions_activities"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions" ADD CONSTRAINT "_courses_v_version_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_sessions_locales" ADD CONSTRAINT "_courses_v_version_sessions_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_sessions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_bibliography" ADD CONSTRAINT "_courses_v_version_bibliography_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_bibliography_locales" ADD CONSTRAINT "_courses_v_version_bibliography_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v_version_bibliography"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_location" ADD CONSTRAINT "_courses_v_version_location_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_version_teaching_languages" ADD CONSTRAINT "_courses_v_version_teaching_languages_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_parent_id_courses_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_version_cycle_id_cycles_id_fk" FOREIGN KEY ("version_cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v" ADD CONSTRAINT "_courses_v_version_registration_form_id_forms_id_fk" FOREIGN KEY ("version_registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v_locales" ADD CONSTRAINT "_courses_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_courses_v_locales" ADD CONSTRAINT "_courses_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_rels" ADD CONSTRAINT "_courses_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_courses_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_courses_v_rels" ADD CONSTRAINT "_courses_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "enrollments_locales" ADD CONSTRAINT "enrollments_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_highlights" ADD CONSTRAINT "programmes_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_highlights_locales" ADD CONSTRAINT "programmes_highlights_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes_highlights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_components_course_types" ADD CONSTRAINT "programmes_components_course_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programmes_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_components" ADD CONSTRAINT "programmes_components_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes_components" ADD CONSTRAINT "programmes_components_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_components_locales" ADD CONSTRAINT "programmes_components_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programme_price_plan_items" ADD CONSTRAINT "programme_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programme_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programme_price_plans" ADD CONSTRAINT "programme_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programme_price_plans_locales" ADD CONSTRAINT "programme_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programme_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_testimonials" ADD CONSTRAINT "programmes_testimonials_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes_testimonials" ADD CONSTRAINT "programmes_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_testimonials_locales" ADD CONSTRAINT "programmes_testimonials_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_faqs" ADD CONSTRAINT "programmes_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_faqs_locales" ADD CONSTRAINT "programmes_faqs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes" ADD CONSTRAINT "programmes_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes" ADD CONSTRAINT "programmes_registration_form_id_forms_id_fk" FOREIGN KEY ("registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes_locales" ADD CONSTRAINT "programmes_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "programmes_locales" ADD CONSTRAINT "programmes_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "programmes_rels" ADD CONSTRAINT "programmes_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_highlights" ADD CONSTRAINT "_programmes_v_version_highlights_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_highlights_locales" ADD CONSTRAINT "_programmes_v_version_highlights_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v_version_highlights"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_components_course_types" ADD CONSTRAINT "_programmes_v_version_components_course_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_programmes_v_version_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_components" ADD CONSTRAINT "_programmes_v_version_components_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_components" ADD CONSTRAINT "_programmes_v_version_components_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_components_locales" ADD CONSTRAINT "_programmes_v_version_components_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v_version_components"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programme_price_plan_items_v" ADD CONSTRAINT "_programme_price_plan_items_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programme_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programme_price_plans_v" ADD CONSTRAINT "_programme_price_plans_v_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programme_price_plans_v_locales" ADD CONSTRAINT "_programme_price_plans_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programme_price_plans_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_testimonials" ADD CONSTRAINT "_programmes_v_version_testimonials_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_testimonials" ADD CONSTRAINT "_programmes_v_version_testimonials_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_testimonials_locales" ADD CONSTRAINT "_programmes_v_version_testimonials_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v_version_testimonials"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_faqs" ADD CONSTRAINT "_programmes_v_version_faqs_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_version_faqs_locales" ADD CONSTRAINT "_programmes_v_version_faqs_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v_version_faqs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v" ADD CONSTRAINT "_programmes_v_parent_id_programmes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v" ADD CONSTRAINT "_programmes_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v" ADD CONSTRAINT "_programmes_v_version_registration_form_id_forms_id_fk" FOREIGN KEY ("version_registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v_locales" ADD CONSTRAINT "_programmes_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_programmes_v_locales" ADD CONSTRAINT "_programmes_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_programmes_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_programmes_v_rels" ADD CONSTRAINT "_programmes_v_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycles_pricing_course_types" ADD CONSTRAINT "cycles_pricing_course_types_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."cycles_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plan_items" ADD CONSTRAINT "cycle_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycle_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plans" ADD CONSTRAINT "cycle_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycle_price_plans_locales" ADD CONSTRAINT "cycle_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycle_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycles_pricing" ADD CONSTRAINT "cycles_pricing_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycles_pricing_locales" ADD CONSTRAINT "cycles_pricing_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles_pricing"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "cycles" ADD CONSTRAINT "cycles_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cycles" ADD CONSTRAINT "cycles_registration_form_id_forms_id_fk" FOREIGN KEY ("registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cycles_locales" ADD CONSTRAINT "cycles_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "cycles_locales" ADD CONSTRAINT "cycles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "governance" ADD CONSTRAINT "governance_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "governance_locales" ADD CONSTRAINT "governance_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."governance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_credits" ADD CONSTRAINT "articles_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_credits_locales" ADD CONSTRAINT "articles_credits_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles_credits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_tags" ADD CONSTRAINT "articles_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles" ADD CONSTRAINT "articles_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_locales" ADD CONSTRAINT "articles_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "articles_locales" ADD CONSTRAINT "articles_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "articles_rels" ADD CONSTRAINT "articles_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_credits" ADD CONSTRAINT "_articles_v_version_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_credits_locales" ADD CONSTRAINT "_articles_v_version_credits_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v_version_credits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_version_tags" ADD CONSTRAINT "_articles_v_version_tags_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_parent_id_articles_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v" ADD CONSTRAINT "_articles_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_locales" ADD CONSTRAINT "_articles_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_articles_v_locales" ADD CONSTRAINT "_articles_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_articles_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_articles_v_rels" ADD CONSTRAINT "_articles_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_credits" ADD CONSTRAINT "publications_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_credits_locales" ADD CONSTRAINT "publications_credits_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."publications_credits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications" ADD CONSTRAINT "publications_foreword_id_articles_id_fk" FOREIGN KEY ("foreword_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications_locales" ADD CONSTRAINT "publications_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "publications_locales" ADD CONSTRAINT "publications_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "publications_rels" ADD CONSTRAINT "publications_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "press_authors" ADD CONSTRAINT "press_authors_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "press_authors" ADD CONSTRAINT "press_authors_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "press_links" ADD CONSTRAINT "press_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "press" ADD CONSTRAINT "press_outlet_id_partners_id_fk" FOREIGN KEY ("outlet_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "press_locales" ADD CONSTRAINT "press_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "press_locales" ADD CONSTRAINT "press_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_schedule_slots" ADD CONSTRAINT "events_schedule_slots_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_schedule_slots_locales" ADD CONSTRAINT "events_schedule_slots_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_schedule_slots"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_agenda" ADD CONSTRAINT "events_agenda_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_agenda_locales" ADD CONSTRAINT "events_agenda_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_agenda"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_speakers" ADD CONSTRAINT "events_speakers_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_speakers" ADD CONSTRAINT "events_speakers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_speakers_locales" ADD CONSTRAINT "events_speakers_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events_speakers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events_partners" ADD CONSTRAINT "events_partners_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_partners" ADD CONSTRAINT "events_partners_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plan_items" ADD CONSTRAINT "event_price_plan_items_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."event_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plans" ADD CONSTRAINT "event_price_plans_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "event_price_plans_locales" ADD CONSTRAINT "event_price_plans_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."event_price_plans"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_series_id_events_id_fk" FOREIGN KEY ("series_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events" ADD CONSTRAINT "events_registration_form_id_forms_id_fk" FOREIGN KEY ("registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_locales" ADD CONSTRAINT "events_locales_meta_image_id_media_id_fk" FOREIGN KEY ("meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "events_locales" ADD CONSTRAINT "events_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_cover_image_id_media_id_fk" FOREIGN KEY ("cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_locales" ADD CONSTRAINT "newsletters_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_parent_id_newsletters_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_locales" ADD CONSTRAINT "_newsletters_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "spaces_images" ADD CONSTRAINT "spaces_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "spaces_images" ADD CONSTRAINT "spaces_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "spaces_locales" ADD CONSTRAINT "spaces_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners_kind" ADD CONSTRAINT "partners_kind_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "partners" ADD CONSTRAINT "partners_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "partners_locales" ADD CONSTRAINT "partners_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox" ADD CONSTRAINT "forms_blocks_checkbox_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_checkbox_locales" ADD CONSTRAINT "forms_blocks_checkbox_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_checkbox"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_country" ADD CONSTRAINT "forms_blocks_country_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_country_locales" ADD CONSTRAINT "forms_blocks_country_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_country"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email" ADD CONSTRAINT "forms_blocks_email_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_email_locales" ADD CONSTRAINT "forms_blocks_email_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_email"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_message" ADD CONSTRAINT "forms_blocks_message_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_message_locales" ADD CONSTRAINT "forms_blocks_message_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_message"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_number" ADD CONSTRAINT "forms_blocks_number_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_number_locales" ADD CONSTRAINT "forms_blocks_number_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_number"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options" ADD CONSTRAINT "forms_blocks_select_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_options_locales" ADD CONSTRAINT "forms_blocks_select_options_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select_options"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select" ADD CONSTRAINT "forms_blocks_select_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_select_locales" ADD CONSTRAINT "forms_blocks_select_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_select"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_state" ADD CONSTRAINT "forms_blocks_state_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_state_locales" ADD CONSTRAINT "forms_blocks_state_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_state"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text" ADD CONSTRAINT "forms_blocks_text_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_text_locales" ADD CONSTRAINT "forms_blocks_text_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_text"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea" ADD CONSTRAINT "forms_blocks_textarea_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_blocks_textarea_locales" ADD CONSTRAINT "forms_blocks_textarea_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_blocks_textarea"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_emails" ADD CONSTRAINT "forms_emails_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_emails_locales" ADD CONSTRAINT "forms_emails_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms_emails"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "forms_locales" ADD CONSTRAINT "forms_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_submission_data" ADD CONSTRAINT "form_submissions_submission_data_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_form_id_forms_id_fk" FOREIGN KEY ("form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_press_fk" FOREIGN KEY ("press_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "redirects_rels" ADD CONSTRAINT "redirects_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_memberships_fk" FOREIGN KEY ("memberships_id") REFERENCES "public"."memberships"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_governance_fk" FOREIGN KEY ("governance_id") REFERENCES "public"."governance"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_press_fk" FOREIGN KEY ("press_id") REFERENCES "public"."press"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_newsletters_fk" FOREIGN KEY ("newsletters_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_spaces_fk" FOREIGN KEY ("spaces_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_partners_fk" FOREIGN KEY ("partners_id") REFERENCES "public"."partners"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_forms_fk" FOREIGN KEY ("forms_id") REFERENCES "public"."forms"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_form_submissions_fk" FOREIGN KEY ("form_submissions_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_redirects_fk" FOREIGN KEY ("redirects_id") REFERENCES "public"."redirects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_social_links" ADD CONSTRAINT "site_settings_social_links_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "site_settings_locales" ADD CONSTRAINT "site_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."site_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_roles_order_idx" ON "users_roles" USING btree ("order");
  CREATE INDEX "users_roles_parent_idx" ON "users_roles" USING btree ("parent_id");
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "users_person_idx" ON "users" USING btree ("person_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "people_social_links_order_idx" ON "people_social_links" USING btree ("_order");
  CREATE INDEX "people_social_links_parent_id_idx" ON "people_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "people_slug_idx" ON "people" USING btree ("slug");
  CREATE INDEX "people_photo_idx" ON "people" USING btree ("photo_id");
  CREATE UNIQUE INDEX "people_legacy_url_idx" ON "people" USING btree ("legacy_url");
  CREATE INDEX "people_updated_at_idx" ON "people" USING btree ("updated_at");
  CREATE INDEX "people_created_at_idx" ON "people" USING btree ("created_at");
  CREATE UNIQUE INDEX "people_locales_locale_parent_id_unique" ON "people_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "memberships_person_idx" ON "memberships" USING btree ("person_id");
  CREATE INDEX "memberships_programme_idx" ON "memberships" USING btree ("programme_id");
  CREATE UNIQUE INDEX "memberships_legacy_url_idx" ON "memberships" USING btree ("legacy_url");
  CREATE INDEX "memberships_updated_at_idx" ON "memberships" USING btree ("updated_at");
  CREATE INDEX "memberships_created_at_idx" ON "memberships" USING btree ("created_at");
  CREATE UNIQUE INDEX "person_programme_idx" ON "memberships" USING btree ("person_id","programme_id");
  CREATE UNIQUE INDEX "memberships_locales_locale_parent_id_unique" ON "memberships_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "media_space_idx" ON "media" USING btree ("space_id");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_thumbnail_sizes_thumbnail_filename_idx" ON "media" USING btree ("sizes_thumbnail_filename");
  CREATE INDEX "media_sizes_card_sizes_card_filename_idx" ON "media" USING btree ("sizes_card_filename");
  CREATE INDEX "courses_schedule_slots_order_idx" ON "courses_schedule_slots" USING btree ("_order");
  CREATE INDEX "courses_schedule_slots_parent_id_idx" ON "courses_schedule_slots" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_schedule_slots_locales_locale_parent_id_unique" ON "courses_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "course_price_plan_items_order_idx" ON "course_price_plan_items" USING btree ("_order");
  CREATE INDEX "course_price_plan_items_parent_id_idx" ON "course_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "course_price_plans_order_idx" ON "course_price_plans" USING btree ("_order");
  CREATE INDEX "course_price_plans_parent_id_idx" ON "course_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "course_price_plans_locales_locale_parent_id_unique" ON "course_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_sessions_dates_order_idx" ON "courses_sessions_dates" USING btree ("_order");
  CREATE INDEX "courses_sessions_dates_parent_id_idx" ON "courses_sessions_dates" USING btree ("_parent_id");
  CREATE INDEX "courses_sessions_bibliography_order_idx" ON "courses_sessions_bibliography" USING btree ("_order");
  CREATE INDEX "courses_sessions_bibliography_parent_id_idx" ON "courses_sessions_bibliography" USING btree ("_parent_id");
  CREATE INDEX "courses_sessions_bibliography_title_idx" ON "courses_sessions_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "courses_sessions_bibliography_locales_locale_parent_id_uniqu" ON "courses_sessions_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_sessions_activities_order_idx" ON "courses_sessions_activities" USING btree ("_order");
  CREATE INDEX "courses_sessions_activities_parent_id_idx" ON "courses_sessions_activities" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_sessions_activities_locales_locale_parent_id_unique" ON "courses_sessions_activities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_sessions_order_idx" ON "courses_sessions" USING btree ("_order");
  CREATE INDEX "courses_sessions_parent_id_idx" ON "courses_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "courses_sessions_locales_locale_parent_id_unique" ON "courses_sessions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_bibliography_order_idx" ON "courses_bibliography" USING btree ("_order");
  CREATE INDEX "courses_bibliography_parent_id_idx" ON "courses_bibliography" USING btree ("_parent_id");
  CREATE INDEX "courses_bibliography_title_idx" ON "courses_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "courses_bibliography_locales_locale_parent_id_unique" ON "courses_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_location_order_idx" ON "courses_location" USING btree ("order");
  CREATE INDEX "courses_location_parent_idx" ON "courses_location" USING btree ("parent_id");
  CREATE INDEX "courses_teaching_languages_order_idx" ON "courses_teaching_languages" USING btree ("order");
  CREATE INDEX "courses_teaching_languages_parent_idx" ON "courses_teaching_languages" USING btree ("parent_id");
  CREATE INDEX "courses_cycle_idx" ON "courses" USING btree ("cycle_id");
  CREATE INDEX "courses_cover_image_idx" ON "courses" USING btree ("cover_image_id");
  CREATE UNIQUE INDEX "courses_slug_idx" ON "courses" USING btree ("slug");
  CREATE INDEX "courses_registration_registration_form_idx" ON "courses" USING btree ("registration_form_id");
  CREATE UNIQUE INDEX "courses_legacy_url_idx" ON "courses" USING btree ("legacy_url");
  CREATE INDEX "courses_updated_at_idx" ON "courses" USING btree ("updated_at");
  CREATE INDEX "courses_created_at_idx" ON "courses" USING btree ("created_at");
  CREATE INDEX "courses__status_idx" ON "courses" USING btree ("_status");
  CREATE INDEX "courses_meta_meta_image_idx" ON "courses_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "courses_locales_locale_parent_id_unique" ON "courses_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "courses_rels_order_idx" ON "courses_rels" USING btree ("order");
  CREATE INDEX "courses_rels_parent_idx" ON "courses_rels" USING btree ("parent_id");
  CREATE INDEX "courses_rels_path_idx" ON "courses_rels" USING btree ("path");
  CREATE INDEX "courses_rels_people_id_idx" ON "courses_rels" USING btree ("people_id");
  CREATE INDEX "_courses_v_version_schedule_slots_order_idx" ON "_courses_v_version_schedule_slots" USING btree ("_order");
  CREATE INDEX "_courses_v_version_schedule_slots_parent_id_idx" ON "_courses_v_version_schedule_slots" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_version_schedule_slots_locales_locale_parent_id_u" ON "_courses_v_version_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_course_price_plan_items_v_order_idx" ON "_course_price_plan_items_v" USING btree ("_order");
  CREATE INDEX "_course_price_plan_items_v_parent_id_idx" ON "_course_price_plan_items_v" USING btree ("_parent_id");
  CREATE INDEX "_course_price_plans_v_order_idx" ON "_course_price_plans_v" USING btree ("_order");
  CREATE INDEX "_course_price_plans_v_parent_id_idx" ON "_course_price_plans_v" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_course_price_plans_v_locales_locale_parent_id_unique" ON "_course_price_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_version_sessions_dates_order_idx" ON "_courses_v_version_sessions_dates" USING btree ("_order");
  CREATE INDEX "_courses_v_version_sessions_dates_parent_id_idx" ON "_courses_v_version_sessions_dates" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_sessions_bibliography_order_idx" ON "_courses_v_version_sessions_bibliography" USING btree ("_order");
  CREATE INDEX "_courses_v_version_sessions_bibliography_parent_id_idx" ON "_courses_v_version_sessions_bibliography" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_sessions_bibliography_title_idx" ON "_courses_v_version_sessions_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "_courses_v_version_sessions_bibliography_locales_locale_pare" ON "_courses_v_version_sessions_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_version_sessions_activities_order_idx" ON "_courses_v_version_sessions_activities" USING btree ("_order");
  CREATE INDEX "_courses_v_version_sessions_activities_parent_id_idx" ON "_courses_v_version_sessions_activities" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_version_sessions_activities_locales_locale_parent" ON "_courses_v_version_sessions_activities_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_version_sessions_order_idx" ON "_courses_v_version_sessions" USING btree ("_order");
  CREATE INDEX "_courses_v_version_sessions_parent_id_idx" ON "_courses_v_version_sessions" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_courses_v_version_sessions_locales_locale_parent_id_unique" ON "_courses_v_version_sessions_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_version_bibliography_order_idx" ON "_courses_v_version_bibliography" USING btree ("_order");
  CREATE INDEX "_courses_v_version_bibliography_parent_id_idx" ON "_courses_v_version_bibliography" USING btree ("_parent_id");
  CREATE INDEX "_courses_v_version_bibliography_title_idx" ON "_courses_v_version_bibliography_locales" USING btree ("title","_locale");
  CREATE UNIQUE INDEX "_courses_v_version_bibliography_locales_locale_parent_id_uni" ON "_courses_v_version_bibliography_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_version_location_order_idx" ON "_courses_v_version_location" USING btree ("order");
  CREATE INDEX "_courses_v_version_location_parent_idx" ON "_courses_v_version_location" USING btree ("parent_id");
  CREATE INDEX "_courses_v_version_teaching_languages_order_idx" ON "_courses_v_version_teaching_languages" USING btree ("order");
  CREATE INDEX "_courses_v_version_teaching_languages_parent_idx" ON "_courses_v_version_teaching_languages" USING btree ("parent_id");
  CREATE INDEX "_courses_v_parent_idx" ON "_courses_v" USING btree ("parent_id");
  CREATE INDEX "_courses_v_version_version_cycle_idx" ON "_courses_v" USING btree ("version_cycle_id");
  CREATE INDEX "_courses_v_version_version_cover_image_idx" ON "_courses_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_courses_v_version_version_slug_idx" ON "_courses_v" USING btree ("version_slug");
  CREATE INDEX "_courses_v_version_registration_version_registration_for_idx" ON "_courses_v" USING btree ("version_registration_form_id");
  CREATE INDEX "_courses_v_version_version_legacy_url_idx" ON "_courses_v" USING btree ("version_legacy_url");
  CREATE INDEX "_courses_v_version_version_updated_at_idx" ON "_courses_v" USING btree ("version_updated_at");
  CREATE INDEX "_courses_v_version_version_created_at_idx" ON "_courses_v" USING btree ("version_created_at");
  CREATE INDEX "_courses_v_version_version__status_idx" ON "_courses_v" USING btree ("version__status");
  CREATE INDEX "_courses_v_created_at_idx" ON "_courses_v" USING btree ("created_at");
  CREATE INDEX "_courses_v_updated_at_idx" ON "_courses_v" USING btree ("updated_at");
  CREATE INDEX "_courses_v_snapshot_idx" ON "_courses_v" USING btree ("snapshot");
  CREATE INDEX "_courses_v_published_locale_idx" ON "_courses_v" USING btree ("published_locale");
  CREATE INDEX "_courses_v_latest_idx" ON "_courses_v" USING btree ("latest");
  CREATE INDEX "_courses_v_autosave_idx" ON "_courses_v" USING btree ("autosave");
  CREATE INDEX "_courses_v_version_meta_version_meta_image_idx" ON "_courses_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_courses_v_locales_locale_parent_id_unique" ON "_courses_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_courses_v_rels_order_idx" ON "_courses_v_rels" USING btree ("order");
  CREATE INDEX "_courses_v_rels_parent_idx" ON "_courses_v_rels" USING btree ("parent_id");
  CREATE INDEX "_courses_v_rels_path_idx" ON "_courses_v_rels" USING btree ("path");
  CREATE INDEX "_courses_v_rels_people_id_idx" ON "_courses_v_rels" USING btree ("people_id");
  CREATE INDEX "enrollments_person_idx" ON "enrollments" USING btree ("person_id");
  CREATE INDEX "enrollments_course_idx" ON "enrollments" USING btree ("course_id");
  CREATE INDEX "enrollments_updated_at_idx" ON "enrollments" USING btree ("updated_at");
  CREATE INDEX "enrollments_created_at_idx" ON "enrollments" USING btree ("created_at");
  CREATE UNIQUE INDEX "person_course_idx" ON "enrollments" USING btree ("person_id","course_id");
  CREATE UNIQUE INDEX "enrollments_locales_locale_parent_id_unique" ON "enrollments_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_highlights_order_idx" ON "programmes_highlights" USING btree ("_order");
  CREATE INDEX "programmes_highlights_parent_id_idx" ON "programmes_highlights" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programmes_highlights_locales_locale_parent_id_unique" ON "programmes_highlights_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_components_course_types_order_idx" ON "programmes_components_course_types" USING btree ("order");
  CREATE INDEX "programmes_components_course_types_parent_idx" ON "programmes_components_course_types" USING btree ("parent_id");
  CREATE INDEX "programmes_components_order_idx" ON "programmes_components" USING btree ("_order");
  CREATE INDEX "programmes_components_parent_id_idx" ON "programmes_components" USING btree ("_parent_id");
  CREATE INDEX "programmes_components_cycle_idx" ON "programmes_components" USING btree ("cycle_id");
  CREATE UNIQUE INDEX "programmes_components_locales_locale_parent_id_unique" ON "programmes_components_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programme_price_plan_items_order_idx" ON "programme_price_plan_items" USING btree ("_order");
  CREATE INDEX "programme_price_plan_items_parent_id_idx" ON "programme_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "programme_price_plans_order_idx" ON "programme_price_plans" USING btree ("_order");
  CREATE INDEX "programme_price_plans_parent_id_idx" ON "programme_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programme_price_plans_locales_locale_parent_id_unique" ON "programme_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_testimonials_order_idx" ON "programmes_testimonials" USING btree ("_order");
  CREATE INDEX "programmes_testimonials_parent_id_idx" ON "programmes_testimonials" USING btree ("_parent_id");
  CREATE INDEX "programmes_testimonials_person_idx" ON "programmes_testimonials" USING btree ("person_id");
  CREATE UNIQUE INDEX "programmes_testimonials_locales_locale_parent_id_unique" ON "programmes_testimonials_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_faqs_order_idx" ON "programmes_faqs" USING btree ("_order");
  CREATE INDEX "programmes_faqs_parent_id_idx" ON "programmes_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "programmes_faqs_locales_locale_parent_id_unique" ON "programmes_faqs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_cover_idx" ON "programmes" USING btree ("cover_id");
  CREATE UNIQUE INDEX "programmes_slug_idx" ON "programmes" USING btree ("slug");
  CREATE INDEX "programmes_registration_registration_form_idx" ON "programmes" USING btree ("registration_form_id");
  CREATE UNIQUE INDEX "programmes_legacy_url_idx" ON "programmes" USING btree ("legacy_url");
  CREATE INDEX "programmes_updated_at_idx" ON "programmes" USING btree ("updated_at");
  CREATE INDEX "programmes_created_at_idx" ON "programmes" USING btree ("created_at");
  CREATE INDEX "programmes__status_idx" ON "programmes" USING btree ("_status");
  CREATE INDEX "programmes_meta_meta_image_idx" ON "programmes_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "programmes_locales_locale_parent_id_unique" ON "programmes_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "programmes_rels_order_idx" ON "programmes_rels" USING btree ("order");
  CREATE INDEX "programmes_rels_parent_idx" ON "programmes_rels" USING btree ("parent_id");
  CREATE INDEX "programmes_rels_path_idx" ON "programmes_rels" USING btree ("path");
  CREATE INDEX "programmes_rels_cycles_id_idx" ON "programmes_rels" USING btree ("cycles_id");
  CREATE INDEX "programmes_rels_courses_id_idx" ON "programmes_rels" USING btree ("courses_id");
  CREATE INDEX "programmes_rels_partners_id_idx" ON "programmes_rels" USING btree ("partners_id");
  CREATE INDEX "_programmes_v_version_highlights_order_idx" ON "_programmes_v_version_highlights" USING btree ("_order");
  CREATE INDEX "_programmes_v_version_highlights_parent_id_idx" ON "_programmes_v_version_highlights" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_programmes_v_version_highlights_locales_locale_parent_id_un" ON "_programmes_v_version_highlights_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_version_components_course_types_order_idx" ON "_programmes_v_version_components_course_types" USING btree ("order");
  CREATE INDEX "_programmes_v_version_components_course_types_parent_idx" ON "_programmes_v_version_components_course_types" USING btree ("parent_id");
  CREATE INDEX "_programmes_v_version_components_order_idx" ON "_programmes_v_version_components" USING btree ("_order");
  CREATE INDEX "_programmes_v_version_components_parent_id_idx" ON "_programmes_v_version_components" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_version_components_cycle_idx" ON "_programmes_v_version_components" USING btree ("cycle_id");
  CREATE UNIQUE INDEX "_programmes_v_version_components_locales_locale_parent_id_un" ON "_programmes_v_version_components_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programme_price_plan_items_v_order_idx" ON "_programme_price_plan_items_v" USING btree ("_order");
  CREATE INDEX "_programme_price_plan_items_v_parent_id_idx" ON "_programme_price_plan_items_v" USING btree ("_parent_id");
  CREATE INDEX "_programme_price_plans_v_order_idx" ON "_programme_price_plans_v" USING btree ("_order");
  CREATE INDEX "_programme_price_plans_v_parent_id_idx" ON "_programme_price_plans_v" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_programme_price_plans_v_locales_locale_parent_id_unique" ON "_programme_price_plans_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_version_testimonials_order_idx" ON "_programmes_v_version_testimonials" USING btree ("_order");
  CREATE INDEX "_programmes_v_version_testimonials_parent_id_idx" ON "_programmes_v_version_testimonials" USING btree ("_parent_id");
  CREATE INDEX "_programmes_v_version_testimonials_person_idx" ON "_programmes_v_version_testimonials" USING btree ("person_id");
  CREATE UNIQUE INDEX "_programmes_v_version_testimonials_locales_locale_parent_id_" ON "_programmes_v_version_testimonials_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_version_faqs_order_idx" ON "_programmes_v_version_faqs" USING btree ("_order");
  CREATE INDEX "_programmes_v_version_faqs_parent_id_idx" ON "_programmes_v_version_faqs" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_programmes_v_version_faqs_locales_locale_parent_id_unique" ON "_programmes_v_version_faqs_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_parent_idx" ON "_programmes_v" USING btree ("parent_id");
  CREATE INDEX "_programmes_v_version_version_cover_idx" ON "_programmes_v" USING btree ("version_cover_id");
  CREATE INDEX "_programmes_v_version_version_slug_idx" ON "_programmes_v" USING btree ("version_slug");
  CREATE INDEX "_programmes_v_version_registration_version_registration__idx" ON "_programmes_v" USING btree ("version_registration_form_id");
  CREATE INDEX "_programmes_v_version_version_legacy_url_idx" ON "_programmes_v" USING btree ("version_legacy_url");
  CREATE INDEX "_programmes_v_version_version_updated_at_idx" ON "_programmes_v" USING btree ("version_updated_at");
  CREATE INDEX "_programmes_v_version_version_created_at_idx" ON "_programmes_v" USING btree ("version_created_at");
  CREATE INDEX "_programmes_v_version_version__status_idx" ON "_programmes_v" USING btree ("version__status");
  CREATE INDEX "_programmes_v_created_at_idx" ON "_programmes_v" USING btree ("created_at");
  CREATE INDEX "_programmes_v_updated_at_idx" ON "_programmes_v" USING btree ("updated_at");
  CREATE INDEX "_programmes_v_snapshot_idx" ON "_programmes_v" USING btree ("snapshot");
  CREATE INDEX "_programmes_v_published_locale_idx" ON "_programmes_v" USING btree ("published_locale");
  CREATE INDEX "_programmes_v_latest_idx" ON "_programmes_v" USING btree ("latest");
  CREATE INDEX "_programmes_v_version_meta_version_meta_image_idx" ON "_programmes_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_programmes_v_locales_locale_parent_id_unique" ON "_programmes_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_programmes_v_rels_order_idx" ON "_programmes_v_rels" USING btree ("order");
  CREATE INDEX "_programmes_v_rels_parent_idx" ON "_programmes_v_rels" USING btree ("parent_id");
  CREATE INDEX "_programmes_v_rels_path_idx" ON "_programmes_v_rels" USING btree ("path");
  CREATE INDEX "_programmes_v_rels_cycles_id_idx" ON "_programmes_v_rels" USING btree ("cycles_id");
  CREATE INDEX "_programmes_v_rels_courses_id_idx" ON "_programmes_v_rels" USING btree ("courses_id");
  CREATE INDEX "_programmes_v_rels_partners_id_idx" ON "_programmes_v_rels" USING btree ("partners_id");
  CREATE INDEX "cycles_pricing_course_types_order_idx" ON "cycles_pricing_course_types" USING btree ("order");
  CREATE INDEX "cycles_pricing_course_types_parent_idx" ON "cycles_pricing_course_types" USING btree ("parent_id");
  CREATE INDEX "cycle_price_plan_items_order_idx" ON "cycle_price_plan_items" USING btree ("_order");
  CREATE INDEX "cycle_price_plan_items_parent_id_idx" ON "cycle_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "cycle_price_plans_order_idx" ON "cycle_price_plans" USING btree ("_order");
  CREATE INDEX "cycle_price_plans_parent_id_idx" ON "cycle_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cycle_price_plans_locales_locale_parent_id_unique" ON "cycle_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "cycles_pricing_order_idx" ON "cycles_pricing" USING btree ("_order");
  CREATE INDEX "cycles_pricing_parent_id_idx" ON "cycles_pricing" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "cycles_pricing_locales_locale_parent_id_unique" ON "cycles_pricing_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "cycles_slug_idx" ON "cycles" USING btree ("slug");
  CREATE INDEX "cycles_space_idx" ON "cycles" USING btree ("space_id");
  CREATE INDEX "cycles_academic_year_idx" ON "cycles" USING btree ("academic_year");
  CREATE INDEX "cycles_registration_registration_form_idx" ON "cycles" USING btree ("registration_form_id");
  CREATE UNIQUE INDEX "cycles_legacy_url_idx" ON "cycles" USING btree ("legacy_url");
  CREATE INDEX "cycles_updated_at_idx" ON "cycles" USING btree ("updated_at");
  CREATE INDEX "cycles_created_at_idx" ON "cycles" USING btree ("created_at");
  CREATE UNIQUE INDEX "season_start_year_space_idx" ON "cycles" USING btree ("season","start_year","space_id");
  CREATE INDEX "cycles_meta_meta_image_idx" ON "cycles_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "cycles_locales_locale_parent_id_unique" ON "cycles_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "governance_person_idx" ON "governance" USING btree ("person_id");
  CREATE UNIQUE INDEX "governance_legacy_url_idx" ON "governance" USING btree ("legacy_url");
  CREATE INDEX "governance_updated_at_idx" ON "governance" USING btree ("updated_at");
  CREATE INDEX "governance_created_at_idx" ON "governance" USING btree ("created_at");
  CREATE UNIQUE INDEX "governance_locales_locale_parent_id_unique" ON "governance_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_credits_order_idx" ON "articles_credits" USING btree ("_order");
  CREATE INDEX "articles_credits_parent_id_idx" ON "articles_credits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_credits_locales_locale_parent_id_unique" ON "articles_credits_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_tags_order_idx" ON "articles_tags" USING btree ("_order");
  CREATE INDEX "articles_tags_parent_id_idx" ON "articles_tags" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "articles_slug_idx" ON "articles" USING btree ("slug");
  CREATE INDEX "articles_cover_image_idx" ON "articles" USING btree ("cover_image_id");
  CREATE UNIQUE INDEX "articles_legacy_url_idx" ON "articles" USING btree ("legacy_url");
  CREATE INDEX "articles_updated_at_idx" ON "articles" USING btree ("updated_at");
  CREATE INDEX "articles_created_at_idx" ON "articles" USING btree ("created_at");
  CREATE INDEX "articles__status_idx" ON "articles" USING btree ("_status");
  CREATE INDEX "articles_meta_meta_image_idx" ON "articles_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "articles_locales_locale_parent_id_unique" ON "articles_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "articles_rels_order_idx" ON "articles_rels" USING btree ("order");
  CREATE INDEX "articles_rels_parent_idx" ON "articles_rels" USING btree ("parent_id");
  CREATE INDEX "articles_rels_path_idx" ON "articles_rels" USING btree ("path");
  CREATE INDEX "articles_rels_people_id_idx" ON "articles_rels" USING btree ("people_id");
  CREATE INDEX "articles_rels_articles_id_idx" ON "articles_rels" USING btree ("articles_id");
  CREATE INDEX "_articles_v_version_credits_order_idx" ON "_articles_v_version_credits" USING btree ("_order");
  CREATE INDEX "_articles_v_version_credits_parent_id_idx" ON "_articles_v_version_credits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_articles_v_version_credits_locales_locale_parent_id_unique" ON "_articles_v_version_credits_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_articles_v_version_tags_order_idx" ON "_articles_v_version_tags" USING btree ("_order");
  CREATE INDEX "_articles_v_version_tags_parent_id_idx" ON "_articles_v_version_tags" USING btree ("_parent_id");
  CREATE INDEX "_articles_v_parent_idx" ON "_articles_v" USING btree ("parent_id");
  CREATE INDEX "_articles_v_version_version_slug_idx" ON "_articles_v" USING btree ("version_slug");
  CREATE INDEX "_articles_v_version_version_cover_image_idx" ON "_articles_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_articles_v_version_version_legacy_url_idx" ON "_articles_v" USING btree ("version_legacy_url");
  CREATE INDEX "_articles_v_version_version_updated_at_idx" ON "_articles_v" USING btree ("version_updated_at");
  CREATE INDEX "_articles_v_version_version_created_at_idx" ON "_articles_v" USING btree ("version_created_at");
  CREATE INDEX "_articles_v_version_version__status_idx" ON "_articles_v" USING btree ("version__status");
  CREATE INDEX "_articles_v_created_at_idx" ON "_articles_v" USING btree ("created_at");
  CREATE INDEX "_articles_v_updated_at_idx" ON "_articles_v" USING btree ("updated_at");
  CREATE INDEX "_articles_v_snapshot_idx" ON "_articles_v" USING btree ("snapshot");
  CREATE INDEX "_articles_v_published_locale_idx" ON "_articles_v" USING btree ("published_locale");
  CREATE INDEX "_articles_v_latest_idx" ON "_articles_v" USING btree ("latest");
  CREATE INDEX "_articles_v_version_meta_version_meta_image_idx" ON "_articles_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_articles_v_locales_locale_parent_id_unique" ON "_articles_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_articles_v_rels_order_idx" ON "_articles_v_rels" USING btree ("order");
  CREATE INDEX "_articles_v_rels_parent_idx" ON "_articles_v_rels" USING btree ("parent_id");
  CREATE INDEX "_articles_v_rels_path_idx" ON "_articles_v_rels" USING btree ("path");
  CREATE INDEX "_articles_v_rels_people_id_idx" ON "_articles_v_rels" USING btree ("people_id");
  CREATE INDEX "_articles_v_rels_articles_id_idx" ON "_articles_v_rels" USING btree ("articles_id");
  CREATE INDEX "publications_credits_order_idx" ON "publications_credits" USING btree ("_order");
  CREATE INDEX "publications_credits_parent_id_idx" ON "publications_credits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "publications_credits_locales_locale_parent_id_unique" ON "publications_credits_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "publications_cover_image_idx" ON "publications" USING btree ("cover_image_id");
  CREATE UNIQUE INDEX "publications_slug_idx" ON "publications" USING btree ("slug");
  CREATE INDEX "publications_foreword_idx" ON "publications" USING btree ("foreword_id");
  CREATE UNIQUE INDEX "publications_legacy_url_idx" ON "publications" USING btree ("legacy_url");
  CREATE INDEX "publications_updated_at_idx" ON "publications" USING btree ("updated_at");
  CREATE INDEX "publications_created_at_idx" ON "publications" USING btree ("created_at");
  CREATE INDEX "publications_meta_meta_image_idx" ON "publications_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "publications_locales_locale_parent_id_unique" ON "publications_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "publications_rels_order_idx" ON "publications_rels" USING btree ("order");
  CREATE INDEX "publications_rels_parent_idx" ON "publications_rels" USING btree ("parent_id");
  CREATE INDEX "publications_rels_path_idx" ON "publications_rels" USING btree ("path");
  CREATE INDEX "publications_rels_articles_id_idx" ON "publications_rels" USING btree ("articles_id");
  CREATE INDEX "publications_rels_people_id_idx" ON "publications_rels" USING btree ("people_id");
  CREATE INDEX "publications_rels_courses_id_idx" ON "publications_rels" USING btree ("courses_id");
  CREATE INDEX "publications_rels_partners_id_idx" ON "publications_rels" USING btree ("partners_id");
  CREATE INDEX "press_authors_order_idx" ON "press_authors" USING btree ("_order");
  CREATE INDEX "press_authors_parent_id_idx" ON "press_authors" USING btree ("_parent_id");
  CREATE INDEX "press_authors_person_idx" ON "press_authors" USING btree ("person_id");
  CREATE INDEX "press_links_order_idx" ON "press_links" USING btree ("_order");
  CREATE INDEX "press_links_parent_id_idx" ON "press_links" USING btree ("_parent_id");
  CREATE INDEX "press_outlet_idx" ON "press" USING btree ("outlet_id");
  CREATE UNIQUE INDEX "press_legacy_url_idx" ON "press" USING btree ("legacy_url");
  CREATE INDEX "press_updated_at_idx" ON "press" USING btree ("updated_at");
  CREATE INDEX "press_created_at_idx" ON "press" USING btree ("created_at");
  CREATE INDEX "press_meta_meta_image_idx" ON "press_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "press_locales_locale_parent_id_unique" ON "press_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_schedule_slots_order_idx" ON "events_schedule_slots" USING btree ("_order");
  CREATE INDEX "events_schedule_slots_parent_id_idx" ON "events_schedule_slots" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "events_schedule_slots_locales_locale_parent_id_unique" ON "events_schedule_slots_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_agenda_order_idx" ON "events_agenda" USING btree ("_order");
  CREATE INDEX "events_agenda_parent_id_idx" ON "events_agenda" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "events_agenda_locales_locale_parent_id_unique" ON "events_agenda_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_speakers_order_idx" ON "events_speakers" USING btree ("_order");
  CREATE INDEX "events_speakers_parent_id_idx" ON "events_speakers" USING btree ("_parent_id");
  CREATE INDEX "events_speakers_person_idx" ON "events_speakers" USING btree ("person_id");
  CREATE UNIQUE INDEX "events_speakers_locales_locale_parent_id_unique" ON "events_speakers_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_partners_order_idx" ON "events_partners" USING btree ("_order");
  CREATE INDEX "events_partners_parent_id_idx" ON "events_partners" USING btree ("_parent_id");
  CREATE INDEX "events_partners_partner_idx" ON "events_partners" USING btree ("partner_id");
  CREATE INDEX "event_price_plan_items_order_idx" ON "event_price_plan_items" USING btree ("_order");
  CREATE INDEX "event_price_plan_items_parent_id_idx" ON "event_price_plan_items" USING btree ("_parent_id");
  CREATE INDEX "event_price_plans_order_idx" ON "event_price_plans" USING btree ("_order");
  CREATE INDEX "event_price_plans_parent_id_idx" ON "event_price_plans" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "event_price_plans_locales_locale_parent_id_unique" ON "event_price_plans_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "events_series_idx" ON "events" USING btree ("series_id");
  CREATE INDEX "events_programme_idx" ON "events" USING btree ("programme_id");
  CREATE INDEX "events_course_idx" ON "events" USING btree ("course_id");
  CREATE UNIQUE INDEX "events_slug_idx" ON "events" USING btree ("slug");
  CREATE INDEX "events_space_idx" ON "events" USING btree ("space_id");
  CREATE INDEX "events_registration_registration_form_idx" ON "events" USING btree ("registration_form_id");
  CREATE UNIQUE INDEX "events_legacy_url_idx" ON "events" USING btree ("legacy_url");
  CREATE INDEX "events_updated_at_idx" ON "events" USING btree ("updated_at");
  CREATE INDEX "events_created_at_idx" ON "events" USING btree ("created_at");
  CREATE INDEX "events_meta_meta_image_idx" ON "events_locales" USING btree ("meta_image_id","_locale");
  CREATE UNIQUE INDEX "events_locales_locale_parent_id_unique" ON "events_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "newsletters_slug_idx" ON "newsletters" USING btree ("slug");
  CREATE INDEX "newsletters_cover_image_idx" ON "newsletters" USING btree ("cover_image_id");
  CREATE UNIQUE INDEX "newsletters_legacy_url_idx" ON "newsletters" USING btree ("legacy_url");
  CREATE INDEX "newsletters_updated_at_idx" ON "newsletters" USING btree ("updated_at");
  CREATE INDEX "newsletters_created_at_idx" ON "newsletters" USING btree ("created_at");
  CREATE INDEX "newsletters__status_idx" ON "newsletters" USING btree ("_status");
  CREATE UNIQUE INDEX "newsletters_locales_locale_parent_id_unique" ON "newsletters_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_newsletters_v_parent_idx" ON "_newsletters_v" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_version_version_slug_idx" ON "_newsletters_v" USING btree ("version_slug");
  CREATE INDEX "_newsletters_v_version_version_cover_image_idx" ON "_newsletters_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_newsletters_v_version_version_legacy_url_idx" ON "_newsletters_v" USING btree ("version_legacy_url");
  CREATE INDEX "_newsletters_v_version_version_updated_at_idx" ON "_newsletters_v" USING btree ("version_updated_at");
  CREATE INDEX "_newsletters_v_version_version_created_at_idx" ON "_newsletters_v" USING btree ("version_created_at");
  CREATE INDEX "_newsletters_v_version_version__status_idx" ON "_newsletters_v" USING btree ("version__status");
  CREATE INDEX "_newsletters_v_created_at_idx" ON "_newsletters_v" USING btree ("created_at");
  CREATE INDEX "_newsletters_v_updated_at_idx" ON "_newsletters_v" USING btree ("updated_at");
  CREATE INDEX "_newsletters_v_snapshot_idx" ON "_newsletters_v" USING btree ("snapshot");
  CREATE INDEX "_newsletters_v_published_locale_idx" ON "_newsletters_v" USING btree ("published_locale");
  CREATE INDEX "_newsletters_v_latest_idx" ON "_newsletters_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_newsletters_v_locales_locale_parent_id_unique" ON "_newsletters_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "spaces_images_order_idx" ON "spaces_images" USING btree ("_order");
  CREATE INDEX "spaces_images_parent_id_idx" ON "spaces_images" USING btree ("_parent_id");
  CREATE INDEX "spaces_images_image_idx" ON "spaces_images" USING btree ("image_id");
  CREATE UNIQUE INDEX "spaces_slug_idx" ON "spaces" USING btree ("slug");
  CREATE UNIQUE INDEX "spaces_legacy_url_idx" ON "spaces" USING btree ("legacy_url");
  CREATE INDEX "spaces_updated_at_idx" ON "spaces" USING btree ("updated_at");
  CREATE INDEX "spaces_created_at_idx" ON "spaces" USING btree ("created_at");
  CREATE UNIQUE INDEX "spaces_locales_locale_parent_id_unique" ON "spaces_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "partners_kind_order_idx" ON "partners_kind" USING btree ("order");
  CREATE INDEX "partners_kind_parent_idx" ON "partners_kind" USING btree ("parent_id");
  CREATE UNIQUE INDEX "partners_slug_idx" ON "partners" USING btree ("slug");
  CREATE INDEX "partners_logo_idx" ON "partners" USING btree ("logo_id");
  CREATE UNIQUE INDEX "partners_legacy_url_idx" ON "partners" USING btree ("legacy_url");
  CREATE INDEX "partners_updated_at_idx" ON "partners" USING btree ("updated_at");
  CREATE INDEX "partners_created_at_idx" ON "partners" USING btree ("created_at");
  CREATE UNIQUE INDEX "partners_locales_locale_parent_id_unique" ON "partners_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_checkbox_order_idx" ON "forms_blocks_checkbox" USING btree ("_order");
  CREATE INDEX "forms_blocks_checkbox_parent_id_idx" ON "forms_blocks_checkbox" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_checkbox_path_idx" ON "forms_blocks_checkbox" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_checkbox_locales_locale_parent_id_unique" ON "forms_blocks_checkbox_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_country_order_idx" ON "forms_blocks_country" USING btree ("_order");
  CREATE INDEX "forms_blocks_country_parent_id_idx" ON "forms_blocks_country" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_country_path_idx" ON "forms_blocks_country" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_country_locales_locale_parent_id_unique" ON "forms_blocks_country_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_email_order_idx" ON "forms_blocks_email" USING btree ("_order");
  CREATE INDEX "forms_blocks_email_parent_id_idx" ON "forms_blocks_email" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_email_path_idx" ON "forms_blocks_email" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_email_locales_locale_parent_id_unique" ON "forms_blocks_email_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_message_order_idx" ON "forms_blocks_message" USING btree ("_order");
  CREATE INDEX "forms_blocks_message_parent_id_idx" ON "forms_blocks_message" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_message_path_idx" ON "forms_blocks_message" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_message_locales_locale_parent_id_unique" ON "forms_blocks_message_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_number_order_idx" ON "forms_blocks_number" USING btree ("_order");
  CREATE INDEX "forms_blocks_number_parent_id_idx" ON "forms_blocks_number" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_number_path_idx" ON "forms_blocks_number" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_number_locales_locale_parent_id_unique" ON "forms_blocks_number_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_select_options_order_idx" ON "forms_blocks_select_options" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_options_parent_id_idx" ON "forms_blocks_select_options" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_blocks_select_options_locales_locale_parent_id_unique" ON "forms_blocks_select_options_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_select_order_idx" ON "forms_blocks_select" USING btree ("_order");
  CREATE INDEX "forms_blocks_select_parent_id_idx" ON "forms_blocks_select" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_select_path_idx" ON "forms_blocks_select" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_select_locales_locale_parent_id_unique" ON "forms_blocks_select_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_state_order_idx" ON "forms_blocks_state" USING btree ("_order");
  CREATE INDEX "forms_blocks_state_parent_id_idx" ON "forms_blocks_state" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_state_path_idx" ON "forms_blocks_state" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_state_locales_locale_parent_id_unique" ON "forms_blocks_state_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_text_order_idx" ON "forms_blocks_text" USING btree ("_order");
  CREATE INDEX "forms_blocks_text_parent_id_idx" ON "forms_blocks_text" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_text_path_idx" ON "forms_blocks_text" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_text_locales_locale_parent_id_unique" ON "forms_blocks_text_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_blocks_textarea_order_idx" ON "forms_blocks_textarea" USING btree ("_order");
  CREATE INDEX "forms_blocks_textarea_parent_id_idx" ON "forms_blocks_textarea" USING btree ("_parent_id");
  CREATE INDEX "forms_blocks_textarea_path_idx" ON "forms_blocks_textarea" USING btree ("_path");
  CREATE UNIQUE INDEX "forms_blocks_textarea_locales_locale_parent_id_unique" ON "forms_blocks_textarea_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_emails_order_idx" ON "forms_emails" USING btree ("_order");
  CREATE INDEX "forms_emails_parent_id_idx" ON "forms_emails" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "forms_emails_locales_locale_parent_id_unique" ON "forms_emails_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "forms_updated_at_idx" ON "forms" USING btree ("updated_at");
  CREATE INDEX "forms_created_at_idx" ON "forms" USING btree ("created_at");
  CREATE UNIQUE INDEX "forms_locales_locale_parent_id_unique" ON "forms_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "form_submissions_submission_data_order_idx" ON "form_submissions_submission_data" USING btree ("_order");
  CREATE INDEX "form_submissions_submission_data_parent_id_idx" ON "form_submissions_submission_data" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_form_idx" ON "form_submissions" USING btree ("form_id");
  CREATE INDEX "form_submissions_updated_at_idx" ON "form_submissions" USING btree ("updated_at");
  CREATE INDEX "form_submissions_created_at_idx" ON "form_submissions" USING btree ("created_at");
  CREATE UNIQUE INDEX "redirects_from_idx" ON "redirects" USING btree ("from");
  CREATE INDEX "redirects_updated_at_idx" ON "redirects" USING btree ("updated_at");
  CREATE INDEX "redirects_created_at_idx" ON "redirects" USING btree ("created_at");
  CREATE INDEX "redirects_rels_order_idx" ON "redirects_rels" USING btree ("order");
  CREATE INDEX "redirects_rels_parent_idx" ON "redirects_rels" USING btree ("parent_id");
  CREATE INDEX "redirects_rels_path_idx" ON "redirects_rels" USING btree ("path");
  CREATE INDEX "redirects_rels_courses_id_idx" ON "redirects_rels" USING btree ("courses_id");
  CREATE INDEX "redirects_rels_cycles_id_idx" ON "redirects_rels" USING btree ("cycles_id");
  CREATE INDEX "redirects_rels_programmes_id_idx" ON "redirects_rels" USING btree ("programmes_id");
  CREATE INDEX "redirects_rels_publications_id_idx" ON "redirects_rels" USING btree ("publications_id");
  CREATE INDEX "redirects_rels_articles_id_idx" ON "redirects_rels" USING btree ("articles_id");
  CREATE INDEX "redirects_rels_events_id_idx" ON "redirects_rels" USING btree ("events_id");
  CREATE INDEX "redirects_rels_press_id_idx" ON "redirects_rels" USING btree ("press_id");
  CREATE INDEX "redirects_rels_people_id_idx" ON "redirects_rels" USING btree ("people_id");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_people_id_idx" ON "payload_locked_documents_rels" USING btree ("people_id");
  CREATE INDEX "payload_locked_documents_rels_memberships_id_idx" ON "payload_locked_documents_rels" USING btree ("memberships_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_courses_id_idx" ON "payload_locked_documents_rels" USING btree ("courses_id");
  CREATE INDEX "payload_locked_documents_rels_enrollments_id_idx" ON "payload_locked_documents_rels" USING btree ("enrollments_id");
  CREATE INDEX "payload_locked_documents_rels_programmes_id_idx" ON "payload_locked_documents_rels" USING btree ("programmes_id");
  CREATE INDEX "payload_locked_documents_rels_cycles_id_idx" ON "payload_locked_documents_rels" USING btree ("cycles_id");
  CREATE INDEX "payload_locked_documents_rels_governance_id_idx" ON "payload_locked_documents_rels" USING btree ("governance_id");
  CREATE INDEX "payload_locked_documents_rels_articles_id_idx" ON "payload_locked_documents_rels" USING btree ("articles_id");
  CREATE INDEX "payload_locked_documents_rels_publications_id_idx" ON "payload_locked_documents_rels" USING btree ("publications_id");
  CREATE INDEX "payload_locked_documents_rels_press_id_idx" ON "payload_locked_documents_rels" USING btree ("press_id");
  CREATE INDEX "payload_locked_documents_rels_events_id_idx" ON "payload_locked_documents_rels" USING btree ("events_id");
  CREATE INDEX "payload_locked_documents_rels_newsletters_id_idx" ON "payload_locked_documents_rels" USING btree ("newsletters_id");
  CREATE INDEX "payload_locked_documents_rels_spaces_id_idx" ON "payload_locked_documents_rels" USING btree ("spaces_id");
  CREATE INDEX "payload_locked_documents_rels_partners_id_idx" ON "payload_locked_documents_rels" USING btree ("partners_id");
  CREATE INDEX "payload_locked_documents_rels_forms_id_idx" ON "payload_locked_documents_rels" USING btree ("forms_id");
  CREATE INDEX "payload_locked_documents_rels_form_submissions_id_idx" ON "payload_locked_documents_rels" USING btree ("form_submissions_id");
  CREATE INDEX "payload_locked_documents_rels_redirects_id_idx" ON "payload_locked_documents_rels" USING btree ("redirects_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");
  CREATE INDEX "site_settings_social_links_order_idx" ON "site_settings_social_links" USING btree ("_order");
  CREATE INDEX "site_settings_social_links_parent_id_idx" ON "site_settings_social_links" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "site_settings_locales_locale_parent_id_unique" ON "site_settings_locales" USING btree ("_locale","_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_roles" CASCADE;
  DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "people_social_links" CASCADE;
  DROP TABLE "people" CASCADE;
  DROP TABLE "people_locales" CASCADE;
  DROP TABLE "memberships" CASCADE;
  DROP TABLE "memberships_locales" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "courses_schedule_slots" CASCADE;
  DROP TABLE "courses_schedule_slots_locales" CASCADE;
  DROP TABLE "course_price_plan_items" CASCADE;
  DROP TABLE "course_price_plans" CASCADE;
  DROP TABLE "course_price_plans_locales" CASCADE;
  DROP TABLE "courses_sessions_dates" CASCADE;
  DROP TABLE "courses_sessions_bibliography" CASCADE;
  DROP TABLE "courses_sessions_bibliography_locales" CASCADE;
  DROP TABLE "courses_sessions_activities" CASCADE;
  DROP TABLE "courses_sessions_activities_locales" CASCADE;
  DROP TABLE "courses_sessions" CASCADE;
  DROP TABLE "courses_sessions_locales" CASCADE;
  DROP TABLE "courses_bibliography" CASCADE;
  DROP TABLE "courses_bibliography_locales" CASCADE;
  DROP TABLE "courses_location" CASCADE;
  DROP TABLE "courses_teaching_languages" CASCADE;
  DROP TABLE "courses" CASCADE;
  DROP TABLE "courses_locales" CASCADE;
  DROP TABLE "courses_rels" CASCADE;
  DROP TABLE "_courses_v_version_schedule_slots" CASCADE;
  DROP TABLE "_courses_v_version_schedule_slots_locales" CASCADE;
  DROP TABLE "_course_price_plan_items_v" CASCADE;
  DROP TABLE "_course_price_plans_v" CASCADE;
  DROP TABLE "_course_price_plans_v_locales" CASCADE;
  DROP TABLE "_courses_v_version_sessions_dates" CASCADE;
  DROP TABLE "_courses_v_version_sessions_bibliography" CASCADE;
  DROP TABLE "_courses_v_version_sessions_bibliography_locales" CASCADE;
  DROP TABLE "_courses_v_version_sessions_activities" CASCADE;
  DROP TABLE "_courses_v_version_sessions_activities_locales" CASCADE;
  DROP TABLE "_courses_v_version_sessions" CASCADE;
  DROP TABLE "_courses_v_version_sessions_locales" CASCADE;
  DROP TABLE "_courses_v_version_bibliography" CASCADE;
  DROP TABLE "_courses_v_version_bibliography_locales" CASCADE;
  DROP TABLE "_courses_v_version_location" CASCADE;
  DROP TABLE "_courses_v_version_teaching_languages" CASCADE;
  DROP TABLE "_courses_v" CASCADE;
  DROP TABLE "_courses_v_locales" CASCADE;
  DROP TABLE "_courses_v_rels" CASCADE;
  DROP TABLE "enrollments" CASCADE;
  DROP TABLE "enrollments_locales" CASCADE;
  DROP TABLE "programmes_highlights" CASCADE;
  DROP TABLE "programmes_highlights_locales" CASCADE;
  DROP TABLE "programmes_components_course_types" CASCADE;
  DROP TABLE "programmes_components" CASCADE;
  DROP TABLE "programmes_components_locales" CASCADE;
  DROP TABLE "programme_price_plan_items" CASCADE;
  DROP TABLE "programme_price_plans" CASCADE;
  DROP TABLE "programme_price_plans_locales" CASCADE;
  DROP TABLE "programmes_testimonials" CASCADE;
  DROP TABLE "programmes_testimonials_locales" CASCADE;
  DROP TABLE "programmes_faqs" CASCADE;
  DROP TABLE "programmes_faqs_locales" CASCADE;
  DROP TABLE "programmes" CASCADE;
  DROP TABLE "programmes_locales" CASCADE;
  DROP TABLE "programmes_rels" CASCADE;
  DROP TABLE "_programmes_v_version_highlights" CASCADE;
  DROP TABLE "_programmes_v_version_highlights_locales" CASCADE;
  DROP TABLE "_programmes_v_version_components_course_types" CASCADE;
  DROP TABLE "_programmes_v_version_components" CASCADE;
  DROP TABLE "_programmes_v_version_components_locales" CASCADE;
  DROP TABLE "_programme_price_plan_items_v" CASCADE;
  DROP TABLE "_programme_price_plans_v" CASCADE;
  DROP TABLE "_programme_price_plans_v_locales" CASCADE;
  DROP TABLE "_programmes_v_version_testimonials" CASCADE;
  DROP TABLE "_programmes_v_version_testimonials_locales" CASCADE;
  DROP TABLE "_programmes_v_version_faqs" CASCADE;
  DROP TABLE "_programmes_v_version_faqs_locales" CASCADE;
  DROP TABLE "_programmes_v" CASCADE;
  DROP TABLE "_programmes_v_locales" CASCADE;
  DROP TABLE "_programmes_v_rels" CASCADE;
  DROP TABLE "cycles_pricing_course_types" CASCADE;
  DROP TABLE "cycle_price_plan_items" CASCADE;
  DROP TABLE "cycle_price_plans" CASCADE;
  DROP TABLE "cycle_price_plans_locales" CASCADE;
  DROP TABLE "cycles_pricing" CASCADE;
  DROP TABLE "cycles_pricing_locales" CASCADE;
  DROP TABLE "cycles" CASCADE;
  DROP TABLE "cycles_locales" CASCADE;
  DROP TABLE "governance" CASCADE;
  DROP TABLE "governance_locales" CASCADE;
  DROP TABLE "articles_credits" CASCADE;
  DROP TABLE "articles_credits_locales" CASCADE;
  DROP TABLE "articles_tags" CASCADE;
  DROP TABLE "articles" CASCADE;
  DROP TABLE "articles_locales" CASCADE;
  DROP TABLE "articles_rels" CASCADE;
  DROP TABLE "_articles_v_version_credits" CASCADE;
  DROP TABLE "_articles_v_version_credits_locales" CASCADE;
  DROP TABLE "_articles_v_version_tags" CASCADE;
  DROP TABLE "_articles_v" CASCADE;
  DROP TABLE "_articles_v_locales" CASCADE;
  DROP TABLE "_articles_v_rels" CASCADE;
  DROP TABLE "publications_credits" CASCADE;
  DROP TABLE "publications_credits_locales" CASCADE;
  DROP TABLE "publications" CASCADE;
  DROP TABLE "publications_locales" CASCADE;
  DROP TABLE "publications_rels" CASCADE;
  DROP TABLE "press_authors" CASCADE;
  DROP TABLE "press_links" CASCADE;
  DROP TABLE "press" CASCADE;
  DROP TABLE "press_locales" CASCADE;
  DROP TABLE "events_schedule_slots" CASCADE;
  DROP TABLE "events_schedule_slots_locales" CASCADE;
  DROP TABLE "events_agenda" CASCADE;
  DROP TABLE "events_agenda_locales" CASCADE;
  DROP TABLE "events_speakers" CASCADE;
  DROP TABLE "events_speakers_locales" CASCADE;
  DROP TABLE "events_partners" CASCADE;
  DROP TABLE "event_price_plan_items" CASCADE;
  DROP TABLE "event_price_plans" CASCADE;
  DROP TABLE "event_price_plans_locales" CASCADE;
  DROP TABLE "events" CASCADE;
  DROP TABLE "events_locales" CASCADE;
  DROP TABLE "newsletters" CASCADE;
  DROP TABLE "newsletters_locales" CASCADE;
  DROP TABLE "_newsletters_v" CASCADE;
  DROP TABLE "_newsletters_v_locales" CASCADE;
  DROP TABLE "spaces_images" CASCADE;
  DROP TABLE "spaces" CASCADE;
  DROP TABLE "spaces_locales" CASCADE;
  DROP TABLE "partners_kind" CASCADE;
  DROP TABLE "partners" CASCADE;
  DROP TABLE "partners_locales" CASCADE;
  DROP TABLE "forms_blocks_checkbox" CASCADE;
  DROP TABLE "forms_blocks_checkbox_locales" CASCADE;
  DROP TABLE "forms_blocks_country" CASCADE;
  DROP TABLE "forms_blocks_country_locales" CASCADE;
  DROP TABLE "forms_blocks_email" CASCADE;
  DROP TABLE "forms_blocks_email_locales" CASCADE;
  DROP TABLE "forms_blocks_message" CASCADE;
  DROP TABLE "forms_blocks_message_locales" CASCADE;
  DROP TABLE "forms_blocks_number" CASCADE;
  DROP TABLE "forms_blocks_number_locales" CASCADE;
  DROP TABLE "forms_blocks_select_options" CASCADE;
  DROP TABLE "forms_blocks_select_options_locales" CASCADE;
  DROP TABLE "forms_blocks_select" CASCADE;
  DROP TABLE "forms_blocks_select_locales" CASCADE;
  DROP TABLE "forms_blocks_state" CASCADE;
  DROP TABLE "forms_blocks_state_locales" CASCADE;
  DROP TABLE "forms_blocks_text" CASCADE;
  DROP TABLE "forms_blocks_text_locales" CASCADE;
  DROP TABLE "forms_blocks_textarea" CASCADE;
  DROP TABLE "forms_blocks_textarea_locales" CASCADE;
  DROP TABLE "forms_emails" CASCADE;
  DROP TABLE "forms_emails_locales" CASCADE;
  DROP TABLE "forms" CASCADE;
  DROP TABLE "forms_locales" CASCADE;
  DROP TABLE "form_submissions_submission_data" CASCADE;
  DROP TABLE "form_submissions" CASCADE;
  DROP TABLE "redirects" CASCADE;
  DROP TABLE "redirects_rels" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TABLE "site_settings_social_links" CASCADE;
  DROP TABLE "site_settings" CASCADE;
  DROP TABLE "site_settings_locales" CASCADE;
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_users_roles";
  DROP TYPE "public"."enum_people_social_links_platform";
  DROP TYPE "public"."enum_people_import_status";
  DROP TYPE "public"."enum_memberships_role";
  DROP TYPE "public"."enum_memberships_import_status";
  DROP TYPE "public"."enum_courses_schedule_slots_weekday";
  DROP TYPE "public"."enum_courses_sessions_bibliography_type";
  DROP TYPE "public"."enum_courses_sessions_activities_kind";
  DROP TYPE "public"."enum_courses_bibliography_type";
  DROP TYPE "public"."enum_courses_location";
  DROP TYPE "public"."enum_courses_teaching_languages";
  DROP TYPE "public"."enum_courses_tier";
  DROP TYPE "public"."enum_courses_course_type";
  DROP TYPE "public"."enum_courses_schedule_start_precision";
  DROP TYPE "public"."enum_courses_registration_method";
  DROP TYPE "public"."enum_courses_pricing_override_currency";
  DROP TYPE "public"."enum_courses_session_unit";
  DROP TYPE "public"."enum_courses_import_status";
  DROP TYPE "public"."enum_courses_status";
  DROP TYPE "public"."enum__courses_v_version_schedule_slots_weekday";
  DROP TYPE "public"."enum__courses_v_version_sessions_bibliography_type";
  DROP TYPE "public"."enum__courses_v_version_sessions_activities_kind";
  DROP TYPE "public"."enum__courses_v_version_bibliography_type";
  DROP TYPE "public"."enum__courses_v_version_location";
  DROP TYPE "public"."enum__courses_v_version_teaching_languages";
  DROP TYPE "public"."enum__courses_v_version_tier";
  DROP TYPE "public"."enum__courses_v_version_course_type";
  DROP TYPE "public"."enum__courses_v_version_schedule_start_precision";
  DROP TYPE "public"."enum__courses_v_version_registration_method";
  DROP TYPE "public"."enum__courses_v_version_pricing_override_currency";
  DROP TYPE "public"."enum__courses_v_version_session_unit";
  DROP TYPE "public"."enum__courses_v_version_import_status";
  DROP TYPE "public"."enum__courses_v_version_status";
  DROP TYPE "public"."enum__courses_v_published_locale";
  DROP TYPE "public"."enum_enrollments_status";
  DROP TYPE "public"."enum_enrollments_source";
  DROP TYPE "public"."enum_programmes_components_course_types";
  DROP TYPE "public"."enum_programmes_kind";
  DROP TYPE "public"."enum_programmes_registration_method";
  DROP TYPE "public"."enum_programmes_pricing_currency";
  DROP TYPE "public"."enum_programmes_import_status";
  DROP TYPE "public"."enum_programmes_status";
  DROP TYPE "public"."enum__programmes_v_version_components_course_types";
  DROP TYPE "public"."enum__programmes_v_version_kind";
  DROP TYPE "public"."enum__programmes_v_version_registration_method";
  DROP TYPE "public"."enum__programmes_v_version_pricing_currency";
  DROP TYPE "public"."enum__programmes_v_version_import_status";
  DROP TYPE "public"."enum__programmes_v_version_status";
  DROP TYPE "public"."enum__programmes_v_published_locale";
  DROP TYPE "public"."enum_cycles_pricing_course_types";
  DROP TYPE "public"."enum_cycles_pricing_pricing_currency";
  DROP TYPE "public"."enum_cycles_season";
  DROP TYPE "public"."enum_cycles_registration_method";
  DROP TYPE "public"."enum_cycles_import_status";
  DROP TYPE "public"."enum_governance_role";
  DROP TYPE "public"."enum_governance_import_status";
  DROP TYPE "public"."enum_articles_credits_role";
  DROP TYPE "public"."enum_articles_review_status";
  DROP TYPE "public"."enum_articles_requested_tier";
  DROP TYPE "public"."enum_articles_tier";
  DROP TYPE "public"."enum_articles_translation_original_language";
  DROP TYPE "public"."enum_articles_import_status";
  DROP TYPE "public"."enum_articles_status";
  DROP TYPE "public"."enum__articles_v_version_credits_role";
  DROP TYPE "public"."enum__articles_v_version_review_status";
  DROP TYPE "public"."enum__articles_v_version_requested_tier";
  DROP TYPE "public"."enum__articles_v_version_tier";
  DROP TYPE "public"."enum__articles_v_version_translation_original_language";
  DROP TYPE "public"."enum__articles_v_version_import_status";
  DROP TYPE "public"."enum__articles_v_version_status";
  DROP TYPE "public"."enum__articles_v_published_locale";
  DROP TYPE "public"."enum_publications_credits_role";
  DROP TYPE "public"."enum_publications_kind";
  DROP TYPE "public"."enum_publications_license";
  DROP TYPE "public"."enum_publications_import_status";
  DROP TYPE "public"."enum_press_links_language";
  DROP TYPE "public"."enum_press_kind";
  DROP TYPE "public"."enum_press_language";
  DROP TYPE "public"."enum_press_date_precision";
  DROP TYPE "public"."enum_press_import_status";
  DROP TYPE "public"."enum_events_schedule_slots_weekday";
  DROP TYPE "public"."enum_events_partners_role";
  DROP TYPE "public"."enum_events_tier";
  DROP TYPE "public"."enum_events_event_type";
  DROP TYPE "public"."enum_events_schedule_start_precision";
  DROP TYPE "public"."enum_events_registration_method";
  DROP TYPE "public"."enum_events_pricing_currency";
  DROP TYPE "public"."enum_events_import_status";
  DROP TYPE "public"."enum_newsletters_import_status";
  DROP TYPE "public"."enum_newsletters_status";
  DROP TYPE "public"."enum__newsletters_v_version_import_status";
  DROP TYPE "public"."enum__newsletters_v_version_status";
  DROP TYPE "public"."enum__newsletters_v_published_locale";
  DROP TYPE "public"."enum_spaces_state";
  DROP TYPE "public"."enum_spaces_import_status";
  DROP TYPE "public"."enum_partners_kind";
  DROP TYPE "public"."enum_partners_import_status";
  DROP TYPE "public"."enum_forms_confirmation_type";
  DROP TYPE "public"."enum_redirects_to_type";
  DROP TYPE "public"."enum_redirects_type";
  DROP TYPE "public"."enum_site_settings_social_links_platform";`)
}
