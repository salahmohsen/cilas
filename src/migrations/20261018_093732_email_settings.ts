import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "email_settings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"logo_id" integer,
  	"accent" varchar,
  	"from_name" varchar,
  	"reply_to" varchar,
  	"footer" varchar,
  	"texts_acceptance_subject" varchar,
  	"texts_acceptance_body" varchar,
  	"texts_acceptance_new_account" varchar,
  	"texts_acceptance_existing_account" varchar,
  	"texts_acceptance_button" varchar,
  	"texts_review_submitted_subject" varchar,
  	"texts_review_submitted" varchar,
  	"texts_review_approved_subject" varchar,
  	"texts_review_approved" varchar,
  	"texts_review_changes_requested_subject" varchar,
  	"texts_review_changes_requested" varchar,
  	"texts_review_rejected_subject" varchar,
  	"texts_review_rejected" varchar,
  	"texts_review_note_label" varchar,
  	"texts_reset_subject" varchar,
  	"texts_reset_body" varchar,
  	"texts_reset_button" varchar,
  	"texts_newsletter_read" varchar,
  	"texts_newsletter_apply" varchar,
  	"texts_newsletter_unsubscribe" varchar,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "email_settings" ADD CONSTRAINT "email_settings_logo_id_media_id_fk" FOREIGN KEY ("logo_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "email_settings_logo_idx" ON "email_settings" USING btree ("logo_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "email_settings" CASCADE;`)
}
