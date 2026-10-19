import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_review_request" AS ENUM('changes', 'removal');
  CREATE TYPE "public"."enum__courses_v_version_review_request" AS ENUM('changes', 'removal');
  CREATE TYPE "public"."enum_articles_review_request" AS ENUM('changes', 'removal');
  CREATE TYPE "public"."enum__articles_v_version_review_request" AS ENUM('changes', 'removal');
  CREATE TYPE "public"."enum_publications_review_request" AS ENUM('changes', 'removal');
  CREATE TYPE "public"."enum__publications_v_version_review_request" AS ENUM('changes', 'removal');
  ALTER TABLE "courses" ADD COLUMN "review_request" "enum_courses_review_request";
  ALTER TABLE "_courses_v" ADD COLUMN "version_review_request" "enum__courses_v_version_review_request";
  ALTER TABLE "articles" ADD COLUMN "review_request" "enum_articles_review_request";
  ALTER TABLE "_articles_v" ADD COLUMN "version_review_request" "enum__articles_v_version_review_request";
  ALTER TABLE "publications" ADD COLUMN "review_request" "enum_publications_review_request";
  ALTER TABLE "_publications_v" ADD COLUMN "version_review_request" "enum__publications_v_version_review_request";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP COLUMN "review_request";
  ALTER TABLE "_courses_v" DROP COLUMN "version_review_request";
  ALTER TABLE "articles" DROP COLUMN "review_request";
  ALTER TABLE "_articles_v" DROP COLUMN "version_review_request";
  ALTER TABLE "publications" DROP COLUMN "review_request";
  ALTER TABLE "_publications_v" DROP COLUMN "version_review_request";
  DROP TYPE "public"."enum_courses_review_request";
  DROP TYPE "public"."enum__courses_v_version_review_request";
  DROP TYPE "public"."enum_articles_review_request";
  DROP TYPE "public"."enum__articles_v_version_review_request";
  DROP TYPE "public"."enum_publications_review_request";
  DROP TYPE "public"."enum__publications_v_version_review_request";`)
}
