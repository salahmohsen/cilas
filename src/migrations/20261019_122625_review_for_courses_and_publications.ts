import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Courses and publications go through review, as articles do. What is
 * already published counts as approved.
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum__courses_v_version_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum_publications_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum__publications_v_version_review_status" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  ALTER TABLE "courses" ADD COLUMN "review_status" "enum_courses_review_status" DEFAULT 'draft';
  ALTER TABLE "courses" ADD COLUMN "review_review_note" varchar;
  ALTER TABLE "_courses_v" ADD COLUMN "version_review_status" "enum__courses_v_version_review_status" DEFAULT 'draft';
  ALTER TABLE "_courses_v" ADD COLUMN "version_review_review_note" varchar;
  ALTER TABLE "publications" ADD COLUMN "review_status" "enum_publications_review_status" DEFAULT 'draft';
  ALTER TABLE "publications" ADD COLUMN "review_review_note" varchar;
  ALTER TABLE "_publications_v" ADD COLUMN "version_review_status" "enum__publications_v_version_review_status" DEFAULT 'draft';
  ALTER TABLE "_publications_v" ADD COLUMN "version_review_review_note" varchar;
  -- What is already published was approved: without this, review would keep
  -- it a draft, and an admin's next edit would unpublish it.
  UPDATE "courses" SET "review_status" = 'approved' WHERE "_status" = 'published';
  UPDATE "_courses_v" SET "version_review_status" = 'approved'
    WHERE "parent_id" IN (SELECT "id" FROM "courses" WHERE "_status" = 'published');
  UPDATE "publications" SET "review_status" = 'approved' WHERE "_status" = 'published';
  UPDATE "_publications_v" SET "version_review_status" = 'approved'
    WHERE "parent_id" IN (SELECT "id" FROM "publications" WHERE "_status" = 'published');`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP COLUMN "review_status";
  ALTER TABLE "courses" DROP COLUMN "review_review_note";
  ALTER TABLE "_courses_v" DROP COLUMN "version_review_status";
  ALTER TABLE "_courses_v" DROP COLUMN "version_review_review_note";
  ALTER TABLE "publications" DROP COLUMN "review_status";
  ALTER TABLE "publications" DROP COLUMN "review_review_note";
  ALTER TABLE "_publications_v" DROP COLUMN "version_review_status";
  ALTER TABLE "_publications_v" DROP COLUMN "version_review_review_note";
  DROP TYPE "public"."enum_courses_review_status";
  DROP TYPE "public"."enum__courses_v_version_review_status";
  DROP TYPE "public"."enum_publications_review_status";
  DROP TYPE "public"."enum__publications_v_version_review_status";`)
}
