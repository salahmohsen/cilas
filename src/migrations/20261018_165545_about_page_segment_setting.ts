import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "about" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cover_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "about_locales" (
  	"title" varchar NOT NULL,
  	"intro" varchar,
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "email_settings" ADD COLUMN "segment_id" varchar;
  ALTER TABLE "about" ADD CONSTRAINT "about_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "about_locales" ADD CONSTRAINT "about_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."about"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "about_cover_idx" ON "about" USING btree ("cover_id");
  CREATE UNIQUE INDEX "about_locales_locale_parent_id_unique" ON "about_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "about_locales_parent_id_idx" ON "about_locales" USING btree ("_parent_id");`)

  // The About page's text was written here too; the page was removed
  // (20261018 drop_about_page), so only its tables remain, dropped there.
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "about" CASCADE;
  DROP TABLE "about_locales" CASCADE;
  ALTER TABLE "email_settings" DROP COLUMN "segment_id";`)
}
