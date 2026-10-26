import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "space_introduction" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "space_introduction_locales" (
  	"title" varchar,
  	"body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "space_introduction_locales" ADD CONSTRAINT "space_introduction_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."space_introduction"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "space_introduction_locales_locale_parent_id_unique" ON "space_introduction_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "space_introduction_locales_parent_id_idx" ON "space_introduction_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "space_introduction" CASCADE;
  DROP TABLE "space_introduction_locales" CASCADE;`)
}
