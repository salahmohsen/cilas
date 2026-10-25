import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_spaces_audience" AS ENUM('all', 'fellows', 'admins');
  ALTER TABLE "spaces" ADD COLUMN "audience" "enum_spaces_audience" DEFAULT 'all';
  ALTER TABLE "spaces_locales" ADD COLUMN "name" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "spaces" DROP COLUMN "audience";
  ALTER TABLE "spaces_locales" DROP COLUMN "name";
  DROP TYPE "public"."enum_spaces_audience";`)
}
