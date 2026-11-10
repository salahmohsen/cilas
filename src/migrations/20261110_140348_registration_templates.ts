import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "registration_defaults" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"cycle_template_id" integer,
  	"bridge_template_id" integer,
  	"workshop_template_id" integer,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  ALTER TABLE "forms" ADD COLUMN "template" boolean DEFAULT false;
  ALTER TABLE "registration_defaults" ADD CONSTRAINT "registration_defaults_cycle_template_id_forms_id_fk" FOREIGN KEY ("cycle_template_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "registration_defaults" ADD CONSTRAINT "registration_defaults_bridge_template_id_forms_id_fk" FOREIGN KEY ("bridge_template_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "registration_defaults" ADD CONSTRAINT "registration_defaults_workshop_template_id_forms_id_fk" FOREIGN KEY ("workshop_template_id") REFERENCES "public"."forms"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "registration_defaults_cycle_template_idx" ON "registration_defaults" USING btree ("cycle_template_id");
  CREATE INDEX "registration_defaults_bridge_template_idx" ON "registration_defaults" USING btree ("bridge_template_id");
  CREATE INDEX "registration_defaults_workshop_template_idx" ON "registration_defaults" USING btree ("workshop_template_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "registration_defaults" CASCADE;
  ALTER TABLE "forms" DROP COLUMN "template";`)
}
