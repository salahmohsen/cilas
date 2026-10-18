import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_newsletters_blocks_picks_items_type" AS ENUM('course', 'article', 'publication', 'cycle', 'event', 'programme');
  CREATE TYPE "public"."enum__newsletters_v_blocks_picks_items_type" AS ENUM('course', 'article', 'publication', 'cycle', 'event', 'programme');
  ALTER TABLE "newsletters_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "type" "enum_newsletters_blocks_picks_items_type" DEFAULT 'course';
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "course_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "article_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "publication_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "cycle_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "event_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD COLUMN "programme_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "type" "enum__newsletters_v_blocks_picks_items_type" DEFAULT 'course';
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "course_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "article_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "publication_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "cycle_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "event_id" integer;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD COLUMN "programme_id" integer;
  ALTER TABLE "spaces" ADD COLUMN "map_url" varchar;
  ALTER TABLE "spaces_locales" ADD COLUMN "address" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "address_space_id" integer;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "newsletters_blocks_picks_items" ADD CONSTRAINT "newsletters_blocks_picks_items_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_publication_id_publications_id_fk" FOREIGN KEY ("publication_id") REFERENCES "public"."publications"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_cycle_id_cycles_id_fk" FOREIGN KEY ("cycle_id") REFERENCES "public"."cycles"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_event_id_events_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."events"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v_blocks_picks_items" ADD CONSTRAINT "_newsletters_v_blocks_picks_items_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_address_space_id_spaces_id_fk" FOREIGN KEY ("address_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "newsletters_blocks_picks_items_course_idx" ON "newsletters_blocks_picks_items" USING btree ("course_id");
  CREATE INDEX "newsletters_blocks_picks_items_article_idx" ON "newsletters_blocks_picks_items" USING btree ("article_id");
  CREATE INDEX "newsletters_blocks_picks_items_publication_idx" ON "newsletters_blocks_picks_items" USING btree ("publication_id");
  CREATE INDEX "newsletters_blocks_picks_items_cycle_idx" ON "newsletters_blocks_picks_items" USING btree ("cycle_id");
  CREATE INDEX "newsletters_blocks_picks_items_event_idx" ON "newsletters_blocks_picks_items" USING btree ("event_id");
  CREATE INDEX "newsletters_blocks_picks_items_programme_idx" ON "newsletters_blocks_picks_items" USING btree ("programme_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_course_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("course_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_article_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("article_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_publication_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("publication_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_cycle_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("cycle_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_event_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("event_id");
  CREATE INDEX "_newsletters_v_blocks_picks_items_programme_idx" ON "_newsletters_v_blocks_picks_items" USING btree ("programme_id");
  CREATE INDEX "email_settings_address_space_idx" ON "email_settings" USING btree ("address_space_id");`)

  // Keep the picks already made: copy each old polymorphic pick (rels table,
  // path "sections.<i>.items.<j>.item") into its type and that type's column,
  // for issues and their drafts, before the rels tables go.
  for (const [items, blocks, rels, prefix, enumType] of [
    ['newsletters_blocks_picks_items', 'newsletters_blocks_picks', 'newsletters_rels', '', 'enum_newsletters_blocks_picks_items_type'],
    ['_newsletters_v_blocks_picks_items', '_newsletters_v_blocks_picks', '_newsletters_v_rels', 'version.', 'enum__newsletters_v_blocks_picks_items_type'],
  ] as const) {
    await db.execute(sql.raw(`
      UPDATE "${items}" i SET
        "type" = (CASE
          WHEN r.courses_id IS NOT NULL THEN 'course'
          WHEN r.articles_id IS NOT NULL THEN 'article'
          WHEN r.publications_id IS NOT NULL THEN 'publication'
          WHEN r.cycles_id IS NOT NULL THEN 'cycle'
          WHEN r.events_id IS NOT NULL THEN 'event'
          ELSE 'programme' END)::"${enumType}",
        "course_id" = r.courses_id,
        "article_id" = r.articles_id,
        "publication_id" = r.publications_id,
        "cycle_id" = r.cycles_id,
        "event_id" = r.events_id,
        "programme_id" = r.programmes_id
      FROM "${blocks}" b, "${rels}" r
      WHERE i._parent_id = b.id
        AND r.parent_id = b._parent_id
        AND r.path = '${prefix}sections.' || (b._order - 1) || '.items.' || (i._order - 1) || '.item';
    `))
  }
  await db.execute(sql`
  DROP TABLE "newsletters_rels" CASCADE;
  DROP TABLE "_newsletters_v_rels" CASCADE;`)

  // The current space: its street address and Google Maps link (emails' footer).
  await db.execute(sql`
  UPDATE "spaces" SET "map_url" = 'https://www.google.com/maps/search/?api=1&query=10%20Darb%20El%20Labana%2C%20El%20Darb%20El%20Ahmar%2C%20Cairo'
    WHERE "slug" = 'darb-el-labbana';
  UPDATE "spaces_locales" SET "address" = '10 Darb El Labana, El Darb El Ahmar, Cairo 11311, Egypt'
    WHERE "_locale" = 'en' AND "_parent_id" = (SELECT "id" FROM "spaces" WHERE "slug" = 'darb-el-labbana');
  UPDATE "spaces_locales" SET "address" = '١٠ درب اللبانة، الدرب الأحمر، القاهرة ١١٣١١، مصر'
    WHERE "_locale" = 'ar' AND "_parent_id" = (SELECT "id" FROM "spaces" WHERE "slug" = 'darb-el-labbana');`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "newsletters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"articles_id" integer,
  	"publications_id" integer,
  	"cycles_id" integer,
  	"events_id" integer,
  	"programmes_id" integer
  );
  
  CREATE TABLE "_newsletters_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"articles_id" integer,
  	"publications_id" integer,
  	"cycles_id" integer,
  	"events_id" integer,
  	"programmes_id" integer
  );
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_course_id_courses_id_fk";
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_article_id_articles_id_fk";
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_publication_id_publications_id_fk";
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_cycle_id_cycles_id_fk";
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_event_id_events_id_fk";
  
  ALTER TABLE "newsletters_blocks_picks_items" DROP CONSTRAINT "newsletters_blocks_picks_items_programme_id_programmes_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_course_id_courses_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_article_id_articles_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_publication_id_publications_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_cycle_id_cycles_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_event_id_events_id_fk";
  
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP CONSTRAINT "_newsletters_v_blocks_picks_items_programme_id_programmes_id_fk";
  
  ALTER TABLE "email_settings" DROP CONSTRAINT "email_settings_address_space_id_spaces_id_fk";
  
  DROP INDEX "newsletters_blocks_picks_items_course_idx";
  DROP INDEX "newsletters_blocks_picks_items_article_idx";
  DROP INDEX "newsletters_blocks_picks_items_publication_idx";
  DROP INDEX "newsletters_blocks_picks_items_cycle_idx";
  DROP INDEX "newsletters_blocks_picks_items_event_idx";
  DROP INDEX "newsletters_blocks_picks_items_programme_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_course_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_article_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_publication_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_cycle_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_event_idx";
  DROP INDEX "_newsletters_v_blocks_picks_items_programme_idx";
  DROP INDEX "email_settings_address_space_idx";
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_publications_fk" FOREIGN KEY ("publications_id") REFERENCES "public"."publications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_events_fk" FOREIGN KEY ("events_id") REFERENCES "public"."events"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_rels_order_idx" ON "newsletters_rels" USING btree ("order");
  CREATE INDEX "newsletters_rels_parent_idx" ON "newsletters_rels" USING btree ("parent_id");
  CREATE INDEX "newsletters_rels_path_idx" ON "newsletters_rels" USING btree ("path");
  CREATE INDEX "newsletters_rels_courses_id_idx" ON "newsletters_rels" USING btree ("courses_id");
  CREATE INDEX "newsletters_rels_articles_id_idx" ON "newsletters_rels" USING btree ("articles_id");
  CREATE INDEX "newsletters_rels_publications_id_idx" ON "newsletters_rels" USING btree ("publications_id");
  CREATE INDEX "newsletters_rels_cycles_id_idx" ON "newsletters_rels" USING btree ("cycles_id");
  CREATE INDEX "newsletters_rels_events_id_idx" ON "newsletters_rels" USING btree ("events_id");
  CREATE INDEX "newsletters_rels_programmes_id_idx" ON "newsletters_rels" USING btree ("programmes_id");
  CREATE INDEX "_newsletters_v_rels_order_idx" ON "_newsletters_v_rels" USING btree ("order");
  CREATE INDEX "_newsletters_v_rels_parent_idx" ON "_newsletters_v_rels" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_rels_path_idx" ON "_newsletters_v_rels" USING btree ("path");
  CREATE INDEX "_newsletters_v_rels_courses_id_idx" ON "_newsletters_v_rels" USING btree ("courses_id");
  CREATE INDEX "_newsletters_v_rels_articles_id_idx" ON "_newsletters_v_rels" USING btree ("articles_id");
  CREATE INDEX "_newsletters_v_rels_publications_id_idx" ON "_newsletters_v_rels" USING btree ("publications_id");
  CREATE INDEX "_newsletters_v_rels_cycles_id_idx" ON "_newsletters_v_rels" USING btree ("cycles_id");
  CREATE INDEX "_newsletters_v_rels_events_id_idx" ON "_newsletters_v_rels" USING btree ("events_id");
  CREATE INDEX "_newsletters_v_rels_programmes_id_idx" ON "_newsletters_v_rels" USING btree ("programmes_id");
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "type";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "course_id";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "article_id";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "publication_id";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "cycle_id";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "event_id";
  ALTER TABLE "newsletters_blocks_picks_items" DROP COLUMN "programme_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "type";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "course_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "article_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "publication_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "cycle_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "event_id";
  ALTER TABLE "_newsletters_v_blocks_picks_items" DROP COLUMN "programme_id";
  ALTER TABLE "spaces" DROP COLUMN "map_url";
  ALTER TABLE "spaces_locales" DROP COLUMN "address";
  ALTER TABLE "email_settings" DROP COLUMN "address_space_id";
  DROP TYPE "public"."enum_newsletters_blocks_picks_items_type";
  DROP TYPE "public"."enum__newsletters_v_blocks_picks_items_type";`)
}
