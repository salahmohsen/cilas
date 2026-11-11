import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_choices_decision" AS ENUM('pending', 'accepted', 'rejected');
  ALTER TABLE "form_submissions_choices" ADD COLUMN "decision" "enum_form_submissions_choices_decision" DEFAULT 'pending';
  ALTER TABLE "form_submissions_choices" ADD COLUMN "decided_at" timestamp(3) with time zone;
  ALTER TABLE "email_settings" ADD COLUMN "texts_rejection_subject" varchar;
  ALTER TABLE "email_settings" ADD COLUMN "texts_rejection_body" varchar;
  UPDATE "form_submissions_choices" AS c SET
    "decision" = (CASE
      WHEN s."status" = 'accepted' AND COALESCE(c."accepted", true) THEN 'accepted'
      WHEN s."status" IN ('accepted', 'rejected') THEN 'rejected'
      ELSE 'pending'
    END)::"public"."enum_form_submissions_choices_decision",
    "decided_at" = CASE WHEN s."status" IN ('accepted', 'rejected') THEN s."decided_at" END
  FROM "form_submissions" AS s
  WHERE s."id" = c."_parent_id";
  ALTER TABLE "form_submissions_choices" DROP COLUMN "accepted";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions_choices" ADD COLUMN "accepted" boolean DEFAULT true;
  UPDATE "form_submissions_choices" SET "accepted" = ("decision" IS DISTINCT FROM 'rejected');
  ALTER TABLE "form_submissions_choices" DROP COLUMN "decision";
  ALTER TABLE "form_submissions_choices" DROP COLUMN "decided_at";
  ALTER TABLE "email_settings" DROP COLUMN "texts_rejection_subject";
  ALTER TABLE "email_settings" DROP COLUMN "texts_rejection_body";
  DROP TYPE "public"."enum_form_submissions_choices_decision";`)
}
