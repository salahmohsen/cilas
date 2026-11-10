import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "form_submissions_result_enrollment_outcomes" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"enrollment_id" integer NOT NULL,
  	"created" boolean
  );
  
  ALTER TABLE "form_submissions" DROP CONSTRAINT "form_submissions_result_enrollment_id_enrollments_id_fk";
  
  DROP INDEX "form_submissions_result_result_enrollment_idx";
  ALTER TABLE "form_submissions_rels" ADD COLUMN "enrollments_id" integer;
  ALTER TABLE "form_submissions_result_enrollment_outcomes" ADD CONSTRAINT "form_submissions_result_enrollment_outcomes_enrollment_id_enrollments_id_fk" FOREIGN KEY ("enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions_result_enrollment_outcomes" ADD CONSTRAINT "form_submissions_result_enrollment_outcomes_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "form_submissions_result_enrollment_outcomes_order_idx" ON "form_submissions_result_enrollment_outcomes" USING btree ("_order");
  CREATE INDEX "form_submissions_result_enrollment_outcomes_parent_id_idx" ON "form_submissions_result_enrollment_outcomes" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_result_enrollment_outcomes_enrollment_idx" ON "form_submissions_result_enrollment_outcomes" USING btree ("enrollment_id");
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_enrollments_fk" FOREIGN KEY ("enrollments_id") REFERENCES "public"."enrollments"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "form_submissions_rels_enrollments_id_idx" ON "form_submissions_rels" USING btree ("enrollments_id");
  INSERT INTO "form_submissions_rels" ("parent_id", "path", "order", "enrollments_id")
    SELECT s.id, 'result.enrollments', row_number() OVER (PARTITION BY s.id ORDER BY e.id), e.id
    FROM "form_submissions" s
    CROSS JOIN LATERAL (
      SELECT s.result_enrollment_id AS id WHERE s.result_enrollment_id IS NOT NULL
      UNION
      SELECT (item->>'enrollment')::integer
      FROM jsonb_array_elements(COALESCE(s.result_enrollments, '[]'::jsonb)) item
    ) e
    JOIN "enrollments" valid ON valid.id = e.id;
  INSERT INTO "form_submissions_result_enrollment_outcomes" ("_order", "_parent_id", "id", "enrollment_id", "created")
    SELECT n::integer, s.id, s.id::text || '-' || n::text, (item->>'enrollment')::integer, (item->>'created')::boolean
    FROM "form_submissions" s
    CROSS JOIN LATERAL jsonb_array_elements(COALESCE(s.result_enrollments, '[]'::jsonb)) WITH ORDINALITY AS items(item, n)
    JOIN "enrollments" valid ON valid.id = (item->>'enrollment')::integer;
  ALTER TABLE "form_submissions" DROP COLUMN "result_enrollment_id";
  ALTER TABLE "form_submissions" DROP COLUMN "result_enrollments";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "form_submissions_rels" DROP CONSTRAINT "form_submissions_rels_enrollments_fk";
  
  DROP INDEX "form_submissions_rels_enrollments_id_idx";
  ALTER TABLE "form_submissions" ADD COLUMN "result_enrollment_id" integer;
  ALTER TABLE "form_submissions" ADD COLUMN "result_enrollments" jsonb;
  ALTER TABLE "form_submissions" ADD CONSTRAINT "form_submissions_result_enrollment_id_enrollments_id_fk" FOREIGN KEY ("result_enrollment_id") REFERENCES "public"."enrollments"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "form_submissions_result_result_enrollment_idx" ON "form_submissions" USING btree ("result_enrollment_id");
  UPDATE "form_submissions" s SET result_enrollment_id = (
    SELECT r.enrollments_id FROM "form_submissions_rels" r WHERE r.parent_id = s.id AND r.path = 'result.enrollments' ORDER BY r."order" LIMIT 1
  ), result_enrollments = (
    SELECT jsonb_agg(jsonb_build_object('enrollment', e.id, 'course', e.course_id, 'title', title.title, 'created', o.created) ORDER BY r."order")
    FROM "form_submissions_rels" r JOIN "enrollments" e ON e.id = r.enrollments_id
    LEFT JOIN "form_submissions_result_enrollment_outcomes" o ON o._parent_id = s.id AND o.enrollment_id = e.id
    LEFT JOIN "courses_locales" title ON title._parent_id = e.course_id AND title._locale = 'en'
    WHERE r.parent_id = s.id AND r.path = 'result.enrollments'
  );
  DROP TABLE "form_submissions_result_enrollment_outcomes" CASCADE;
  DELETE FROM "form_submissions_rels" WHERE "path" = 'result.enrollments';
  ALTER TABLE "form_submissions_rels" DROP COLUMN "enrollments_id";`)
}
