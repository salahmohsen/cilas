import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_publications_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__publications_v_version_credits_role" AS ENUM('author', 'editor', 'translator', 'copy_editor', 'proofreader', 'supervisor', 'coordinator', 'art_director', 'cover_designer', 'illustrator', 'photographer', 'other');
  CREATE TYPE "public"."enum__publications_v_version_kind" AS ENUM('essay_collection', 'translation_booklet', 'research', 'other');
  CREATE TYPE "public"."enum__publications_v_version_license" AS ENUM('cc_by_nc_sa', 'cc_by_sa', 'cc_by', 'all_rights_reserved');
  CREATE TYPE "public"."enum__publications_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__publications_v_published_locale" AS ENUM('en', 'ar');
  CREATE TABLE "_publications_v_version_credits" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"role" "enum__publications_v_version_credits_role",
  	"_uuid" varchar
  );
  
  CREATE TABLE "_publications_v_version_credits_locales" (
  	"label" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_publications_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_kind" "enum__publications_v_version_kind",
  	"version_cover_image_id" integer,
  	"version_generate_slug" boolean DEFAULT true,
  	"version_slug" varchar,
  	"version_foreword_id" integer,
  	"version_license" "enum__publications_v_version_license",
  	"version_print_edition_url" varchar,
  	"version_legacy_url" varchar,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__publications_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__publications_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_publications_v_locales" (
  	"version_title" varchar,
  	"version_subtitle" varchar,
  	"version_intro" jsonb,
  	"version_meta_title" varchar,
  	"version_meta_description" varchar,
  	"version_meta_image_id" integer,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_publications_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"people_id" integer,
  	"articles_id" integer,
  	"courses_id" integer
  );
  
  
  ALTER TABLE "publications_credits" ALTER COLUMN "role" DROP NOT NULL;
  ALTER TABLE "publications" ALTER COLUMN "kind" DROP NOT NULL;
  ALTER TABLE "publications" ALTER COLUMN "slug" DROP NOT NULL;
  ALTER TABLE "publications_locales" ALTER COLUMN "title" DROP NOT NULL;
  ALTER TABLE "publications" ADD COLUMN "_status" "enum_publications_status" DEFAULT 'draft';
  -- Publications made before drafts were all on the site: keep them there.
  UPDATE "publications" SET "_status" = 'published';
  ALTER TABLE "_publications_v_version_credits" ADD CONSTRAINT "_publications_v_version_credits_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_publications_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v_version_credits_locales" ADD CONSTRAINT "_publications_v_version_credits_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_publications_v_version_credits"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v" ADD CONSTRAINT "_publications_v_parent_id_publications_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v" ADD CONSTRAINT "_publications_v_version_cover_image_id_media_id_fk" FOREIGN KEY ("version_cover_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v" ADD CONSTRAINT "_publications_v_version_foreword_id_articles_id_fk" FOREIGN KEY ("version_foreword_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v_locales" ADD CONSTRAINT "_publications_v_locales_version_meta_image_id_media_id_fk" FOREIGN KEY ("version_meta_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_publications_v_locales" ADD CONSTRAINT "_publications_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_publications_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v_rels" ADD CONSTRAINT "_publications_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_publications_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v_rels" ADD CONSTRAINT "_publications_v_rels_people_fk" FOREIGN KEY ("people_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v_rels" ADD CONSTRAINT "_publications_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_publications_v_rels" ADD CONSTRAINT "_publications_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "_publications_v_version_credits_order_idx" ON "_publications_v_version_credits" USING btree ("_order");
  CREATE INDEX "_publications_v_version_credits_parent_id_idx" ON "_publications_v_version_credits" USING btree ("_parent_id");
  CREATE UNIQUE INDEX "_publications_v_version_credits_locales_locale_parent_id_uni" ON "_publications_v_version_credits_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_publications_v_parent_idx" ON "_publications_v" USING btree ("parent_id");
  CREATE INDEX "_publications_v_version_version_cover_image_idx" ON "_publications_v" USING btree ("version_cover_image_id");
  CREATE INDEX "_publications_v_version_version_slug_idx" ON "_publications_v" USING btree ("version_slug");
  CREATE INDEX "_publications_v_version_version_foreword_idx" ON "_publications_v" USING btree ("version_foreword_id");
  CREATE INDEX "_publications_v_version_version_legacy_url_idx" ON "_publications_v" USING btree ("version_legacy_url");
  CREATE INDEX "_publications_v_version_version_updated_at_idx" ON "_publications_v" USING btree ("version_updated_at");
  CREATE INDEX "_publications_v_version_version_created_at_idx" ON "_publications_v" USING btree ("version_created_at");
  CREATE INDEX "_publications_v_version_version__status_idx" ON "_publications_v" USING btree ("version__status");
  CREATE INDEX "_publications_v_created_at_idx" ON "_publications_v" USING btree ("created_at");
  CREATE INDEX "_publications_v_updated_at_idx" ON "_publications_v" USING btree ("updated_at");
  CREATE INDEX "_publications_v_snapshot_idx" ON "_publications_v" USING btree ("snapshot");
  CREATE INDEX "_publications_v_published_locale_idx" ON "_publications_v" USING btree ("published_locale");
  CREATE INDEX "_publications_v_latest_idx" ON "_publications_v" USING btree ("latest");
  CREATE INDEX "_publications_v_version_meta_version_meta_image_idx" ON "_publications_v_locales" USING btree ("version_meta_image_id","_locale");
  CREATE UNIQUE INDEX "_publications_v_locales_locale_parent_id_unique" ON "_publications_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_publications_v_rels_order_idx" ON "_publications_v_rels" USING btree ("order");
  CREATE INDEX "_publications_v_rels_parent_idx" ON "_publications_v_rels" USING btree ("parent_id");
  CREATE INDEX "_publications_v_rels_path_idx" ON "_publications_v_rels" USING btree ("path");
  CREATE INDEX "_publications_v_rels_people_id_idx" ON "_publications_v_rels" USING btree ("people_id");
  CREATE INDEX "_publications_v_rels_articles_id_idx" ON "_publications_v_rels" USING btree ("articles_id");
  CREATE INDEX "_publications_v_rels_courses_id_idx" ON "_publications_v_rels" USING btree ("courses_id");
  CREATE INDEX "publications__status_idx" ON "publications" USING btree ("_status");
  -- press_locales keeps meta_title, meta_description and meta_image_id: press
  -- left SEO_COLLECTIONS without a migration, and 27 rows still hold that text.`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_publications_v_version_credits" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_publications_v_version_credits_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_publications_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_publications_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_publications_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_publications_v_version_credits" CASCADE;
  DROP TABLE "_publications_v_version_credits_locales" CASCADE;
  DROP TABLE "_publications_v" CASCADE;
  DROP TABLE "_publications_v_locales" CASCADE;
  DROP TABLE "_publications_v_rels" CASCADE;
  DROP INDEX "publications__status_idx";
  ALTER TABLE "publications_credits" ALTER COLUMN "role" SET NOT NULL;
  ALTER TABLE "publications" ALTER COLUMN "kind" SET NOT NULL;
  ALTER TABLE "publications" ALTER COLUMN "slug" SET NOT NULL;
  ALTER TABLE "publications_locales" ALTER COLUMN "title" SET NOT NULL;
  ALTER TABLE "publications" DROP COLUMN "_status";
  DROP TYPE "public"."enum_publications_status";
  DROP TYPE "public"."enum__publications_v_version_credits_role";
  DROP TYPE "public"."enum__publications_v_version_kind";
  DROP TYPE "public"."enum__publications_v_version_license";
  DROP TYPE "public"."enum__publications_v_version_status";
  DROP TYPE "public"."enum__publications_v_published_locale";`)
}
