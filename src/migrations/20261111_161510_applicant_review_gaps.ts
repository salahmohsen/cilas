import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_enrollments_status" ADD VALUE 'rejected';
  ALTER TABLE "form_submissions_choices" ADD COLUMN "email_failed" boolean DEFAULT false;
  ALTER TABLE "form_submissions" ADD COLUMN "email_failed" boolean DEFAULT false;`)
  // Old course applications have no choices, so the Applicants page and the
  // per-course decisions cannot reach them. The app is still in testing: give each
  // one an accepted choice for its course, and the application the same decision.
  await db.execute(sql`
  INSERT INTO "form_submissions_choices" ("_order", "_parent_id", "id", "course_id", "decision", "decided_at")
  SELECT 1, s."id", 'legacy-' || s."id", r."courses_id", 'accepted', COALESCE(s."decided_at", s."created_at")
  FROM "form_submissions" AS s
  JOIN "form_submissions_rels" AS r ON r."parent_id" = s."id" AND r."path" = 'target' AND r."courses_id" IS NOT NULL
  WHERE NOT EXISTS (SELECT 1 FROM "form_submissions_choices" AS c WHERE c."_parent_id" = s."id");
  UPDATE "form_submissions" AS s SET "status" = 'accepted', "decided_at" = COALESCE(s."decided_at", s."created_at")
  WHERE EXISTS (SELECT 1 FROM "form_submissions_choices" AS c WHERE c."_parent_id" = s."id" AND c."id" = 'legacy-' || s."id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   UPDATE "enrollments" SET "status" = 'withdrawn' WHERE "status" = 'rejected';
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET DATA TYPE text;
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'applied'::text;
  DROP TYPE "public"."enum_enrollments_status";
  CREATE TYPE "public"."enum_enrollments_status" AS ENUM('applied', 'accepted', 'confirmed', 'completed', 'withdrawn');
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET DEFAULT 'applied'::"public"."enum_enrollments_status";
  ALTER TABLE "enrollments" ALTER COLUMN "status" SET DATA TYPE "public"."enum_enrollments_status" USING "status"::"public"."enum_enrollments_status";
  ALTER TABLE "form_submissions_choices" DROP COLUMN "email_failed";
  ALTER TABLE "form_submissions" DROP COLUMN "email_failed";`)
}
