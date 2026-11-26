import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_account_id_users_id_fk";

  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_space_id_spaces_id_fk";

  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_account_id_users_id_fk";

  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_space_id_spaces_id_fk";

  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;`)
}
