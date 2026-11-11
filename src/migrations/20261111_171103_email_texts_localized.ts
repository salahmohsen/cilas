import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

// The texts admins wrote so far become the English ones. Rows from before the
// form_submissions.locale column stay empty, which reads as English.
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_locale" AS ENUM('en', 'ar');
  CREATE TABLE "email_settings_locales" (
  	"texts_acceptance_subject" varchar,
  	"texts_acceptance_body" varchar,
  	"texts_acceptance_new_account" varchar,
  	"texts_acceptance_existing_account" varchar,
  	"texts_acceptance_button" varchar,
  	"texts_rejection_subject" varchar,
  	"texts_rejection_body" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "form_submissions" ADD COLUMN "locale" "enum_form_submissions_locale";
  ALTER TABLE "email_settings_locales" ADD CONSTRAINT "email_settings_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."email_settings"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "email_settings_locales_locale_parent_id_unique" ON "email_settings_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "email_settings_locales_parent_id_idx" ON "email_settings_locales" USING btree ("_parent_id");
  INSERT INTO "email_settings_locales" ("_parent_id", "_locale", "texts_acceptance_subject", "texts_acceptance_body", "texts_acceptance_new_account", "texts_acceptance_existing_account", "texts_acceptance_button", "texts_rejection_subject", "texts_rejection_body")
  SELECT "id", 'en', "texts_acceptance_subject", "texts_acceptance_body", "texts_acceptance_new_account", "texts_acceptance_existing_account", "texts_acceptance_button", "texts_rejection_subject", "texts_rejection_body" FROM "email_settings";
  ALTER TABLE "email_settings" DROP COLUMN "texts_acceptance_subject";
  ALTER TABLE "email_settings" DROP COLUMN "texts_acceptance_body";
  ALTER TABLE "email_settings" DROP COLUMN "texts_acceptance_new_account";
  ALTER TABLE "email_settings" DROP COLUMN "texts_acceptance_existing_account";
  ALTER TABLE "email_settings" DROP COLUMN "texts_acceptance_button";
  ALTER TABLE "email_settings" DROP COLUMN "texts_rejection_subject";
  ALTER TABLE "email_settings" DROP COLUMN "texts_rejection_body";`)
}

// Lossy: the Arabic texts and every submission's language are dropped. The English texts come back.
export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "email_settings" ADD COLUMN "texts_acceptance_subject" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_acceptance_body" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_acceptance_new_account" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_acceptance_existing_account" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_acceptance_button" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_rejection_subject" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_rejection_body" varchar;
  UPDATE "email_settings" AS e SET "texts_acceptance_subject" = l."texts_acceptance_subject", "texts_acceptance_body" = l."texts_acceptance_body", "texts_acceptance_new_account" = l."texts_acceptance_new_account", "texts_acceptance_existing_account" = l."texts_acceptance_existing_account", "texts_acceptance_button" = l."texts_acceptance_button", "texts_rejection_subject" = l."texts_rejection_subject", "texts_rejection_body" = l."texts_rejection_body"
  FROM "email_settings_locales" AS l
  WHERE l."_parent_id" = e."id" AND l."_locale" = 'en';
  DROP TABLE "email_settings_locales" CASCADE;
  ALTER TABLE "form_submissions" DROP COLUMN "locale";
  DROP TYPE "public"."enum_form_submissions_locale";`)
}
