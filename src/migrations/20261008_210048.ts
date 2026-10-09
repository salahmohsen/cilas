import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_cycles_season" RENAME TO "enum_cycles_cycle_season";
  ALTER TYPE "public"."enum_cycles_mode" RENAME TO "enum_cycles_cycle_mode";
  ALTER TABLE "cycles" RENAME COLUMN "season" TO "cycle_season";
  ALTER TABLE "cycles" RENAME COLUMN "year" TO "cycle_year";
  ALTER TABLE "cycles" RENAME COLUMN "mode" TO "cycle_mode";
  ALTER TABLE "cycles" RENAME COLUMN "programme_id" TO "programme_programme_id";
  ALTER TABLE "cycles" DROP CONSTRAINT "cycles_programme_id_programmes_id_fk";
  
  DROP INDEX "cycles_programme_idx";
  ALTER TABLE "cycles" ADD CONSTRAINT "cycles_programme_programme_id_programmes_id_fk" FOREIGN KEY ("programme_programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cycles_programme_programme_programme_idx" ON "cycles" USING btree ("programme_programme_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_cycles_cycle_season" RENAME TO "enum_cycles_season";
  ALTER TYPE "public"."enum_cycles_cycle_mode" RENAME TO "enum_cycles_mode";
  ALTER TABLE "cycles" RENAME COLUMN "cycle_season" TO "season";
  ALTER TABLE "cycles" RENAME COLUMN "cycle_year" TO "year";
  ALTER TABLE "cycles" RENAME COLUMN "cycle_mode" TO "mode";
  ALTER TABLE "cycles" RENAME COLUMN "programme_programme_id" TO "programme_id";
  ALTER TABLE "cycles" DROP CONSTRAINT "cycles_programme_programme_id_programmes_id_fk";
  
  DROP INDEX "cycles_programme_programme_programme_idx";
  ALTER TABLE "cycles" ADD CONSTRAINT "cycles_programme_id_programmes_id_fk" FOREIGN KEY ("programme_id") REFERENCES "public"."programmes"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "cycles_programme_idx" ON "cycles" USING btree ("programme_id");`)
}
