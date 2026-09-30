import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" RENAME COLUMN "tuition_need_based" TO "tuition_based_deductions_available";
  ALTER TABLE "events" ADD COLUMN "registration_form_id" integer;
  ALTER TABLE "events" ADD CONSTRAINT "events_registration_form_id_forms_id_fk" FOREIGN KEY ("registration_form_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "events_registration_form_idx" ON "events" USING btree ("registration_form_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "events" DROP CONSTRAINT "events_registration_form_id_forms_id_fk";
  
  DROP INDEX "events_registration_form_idx";
  ALTER TABLE "courses" ADD COLUMN "tuition_need_based" boolean;
  ALTER TABLE "courses" DROP COLUMN "tuition_based_deductions_available";
  ALTER TABLE "events" DROP COLUMN "registration_form_id";`)
}
