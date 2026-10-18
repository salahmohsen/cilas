import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_form_submissions_status" AS ENUM('new', 'accepted', 'rejected');
  CREATE TABLE "form_submissions_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"programmes_id" integer,
  	"courses_id" integer
  );
  
  ALTER TABLE "people" ADD COLUMN "visible" boolean DEFAULT false;
  -- Everyone already on the site stays on it; only new people start hidden.
  UPDATE "people" SET "visible" = true;
  ALTER TABLE "form_submissions" ADD COLUMN "status" "enum_form_submissions_status" DEFAULT 'new';
  ALTER TABLE "form_submissions" ADD COLUMN "decided_at" timestamp(3) with time zone;
  ALTER TABLE "form_submissions" ADD COLUMN "result_user_id" integer;
  ALTER TABLE "form_submissions" ADD COLUMN "result_person_id" integer;
  ALTER TABLE "form_submissions" ADD COLUMN "result_membership_id" integer;
  ALTER TABLE "form_submissions" ADD COLUMN "result_enrollment_id" integer;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "form_submissions_rels_order_idx" ON "form_submissions_rels" USING btree ("order");
  CREATE INDEX "form_submissions_rels_parent_idx" ON "form_submissions_rels" USING btree ("parent_id");
  CREATE INDEX "form_submissions_rels_path_idx" ON "form_submissions_rels" USING btree ("path");
  CREATE INDEX "form_submissions_rels_programmes_id_idx" ON "form_submissions_rels" USING btree ("programmes_id");
  CREATE INDEX "form_submissions_rels_courses_id_idx" ON "form_submissions_rels" USING btree ("courses_id");
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_result_user_id_users_id_fk" FOREIGN KEY ("result_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_result_person_id_people_id_fk" FOREIGN KEY ("result_person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_result_membership_id_memberships_id_fk" FOREIGN KEY ("result_membership_id") REFERENCES "public"."memberships"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_result_enrollment_id_enrollments_id_fk" FOREIGN KEY ("result_enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "people_visible_idx" ON "people" USING btree ("visible");
  CREATE INDEX "form_submissions_status_idx" ON "form_submissions" USING btree ("status");
  CREATE INDEX "form_submissions_result_result_user_idx" ON "form_submissions" USING btree ("result_user_id");
  CREATE INDEX "form_submissions_result_result_person_idx" ON "form_submissions" USING btree ("result_person_id");
  CREATE INDEX "form_submissions_result_result_membership_idx" ON "form_submissions" USING btree ("result_membership_id");
  CREATE INDEX "form_submissions_result_result_enrollment_idx" ON "form_submissions" USING btree ("result_enrollment_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "form_submissions_rels" CASCADE;
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_result_user_id_users_id_fk";
  
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_result_person_id_people_id_fk";
  
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_result_membership_id_memberships_id_fk";
  
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_result_enrollment_id_enrollments_id_fk";
  
  DROP INDEX "people_visible_idx";
  DROP INDEX "form_submissions_status_idx";
  DROP INDEX "form_submissions_result_result_user_idx";
  DROP INDEX "form_submissions_result_result_person_idx";
  DROP INDEX "form_submissions_result_result_membership_idx";
  DROP INDEX "form_submissions_result_result_enrollment_idx";
  ALTER TABLE "people" DROP COLUMN "visible";
  ALTER TABLE "form_submissions" DROP COLUMN "status";
  ALTER TABLE "form_submissions" DROP COLUMN "decided_at";
  ALTER TABLE "form_submissions" DROP COLUMN "result_user_id";
  ALTER TABLE "form_submissions" DROP COLUMN "result_person_id";
  ALTER TABLE "form_submissions" DROP COLUMN "result_membership_id";
  ALTER TABLE "form_submissions" DROP COLUMN "result_enrollment_id";
  DROP TYPE "public"."enum_form_submissions_status";`)
}
