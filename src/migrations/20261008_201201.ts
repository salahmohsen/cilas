import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "cycles" ADD COLUMN "label" varchar NOT NULL;
  ALTER TABLE "programmes" DROP COLUMN "kind";
  DROP TYPE "public"."enum_programmes_kind";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_programmes_kind" AS ENUM('BRIDGE');
  ALTER TABLE "programmes" ADD COLUMN "kind" "enum_programmes_kind";
  ALTER TABLE "cycles" DROP COLUMN "label";`)
}
