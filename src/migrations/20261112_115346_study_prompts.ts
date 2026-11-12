import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "study_prompts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "study_prompts_locales" (
  	"course_full" varchar,
  	"course_compact" varchar,
  	"course_short" varchar,
  	"article_full" varchar,
  	"article_compact" varchar,
  	"article_short" varchar,
  	"session_full" varchar,
  	"session_compact" varchar,
  	"session_short" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "study_prompts_locales" ADD CONSTRAINT "study_prompts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."study_prompts"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "study_prompts_locales_locale_parent_id_unique" ON "study_prompts_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "study_prompts_locales_parent_id_idx" ON "study_prompts_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "study_prompts" CASCADE;
  DROP TABLE "study_prompts_locales" CASCADE;`)
}
