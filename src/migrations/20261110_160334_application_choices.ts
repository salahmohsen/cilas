import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "form_submissions_choices_answers" (
    "_order" integer NOT NULL,
    "_parent_id" varchar NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "name" varchar NOT NULL,
    "label" varchar,
    "value" varchar
  );

  CREATE TABLE "form_submissions_choices" (
    "_order" integer NOT NULL,
    "_parent_id" integer NOT NULL,
    "id" varchar PRIMARY KEY NOT NULL,
    "course_id" integer NOT NULL,
    "amount" numeric,
    "need_reduction" boolean,
    "accepted" boolean DEFAULT true
  );

  ALTER TABLE "form_submissions_rels" ADD COLUMN "cycles_id" integer;
  ALTER TABLE "form_submissions_choices_answers" ADD CONSTRAINT "form_submissions_choices_answers_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."form_submissions_choices"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "form_submissions_choices" ADD CONSTRAINT "form_submissions_choices_course_id_courses_id_fk" FOREIGN KEY ("course_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "form_submissions_choices" ADD CONSTRAINT "form_submissions_choices_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."form_submissions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "form_submissions_choices_answers_order_idx" ON "form_submissions_choices_answers" USING btree ("_order");
  CREATE INDEX "form_submissions_choices_answers_parent_id_idx" ON "form_submissions_choices_answers" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_choices_order_idx" ON "form_submissions_choices" USING btree ("_order");
  CREATE INDEX "form_submissions_choices_parent_id_idx" ON "form_submissions_choices" USING btree ("_parent_id");
  CREATE INDEX "form_submissions_choices_course_idx" ON "form_submissions_choices" USING btree ("course_id");
  ALTER TABLE "form_submissions_rels" ADD CONSTRAINT "form_submissions_rels_cycles_fk" FOREIGN KEY ("cycles_id") REFERENCES "public"."cycles"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "form_submissions_rels_cycles_id_idx" ON "form_submissions_rels" USING btree ("cycles_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "form_submissions_choices_answers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "form_submissions_choices" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "form_submissions_choices_answers" CASCADE;
  DROP TABLE "form_submissions_choices" CASCADE;
  ALTER TABLE "form_submissions_rels" DROP CONSTRAINT "form_submissions_rels_cycles_fk";

  DROP INDEX "form_submissions_rels_cycles_id_idx";
  ALTER TABLE "form_submissions_rels" DROP COLUMN "cycles_id";`)
}
