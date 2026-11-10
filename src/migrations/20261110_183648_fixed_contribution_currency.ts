import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "courses" DROP COLUMN "pricing_override_currency";
  ALTER TABLE "_courses_v" DROP COLUMN "version_pricing_override_currency";
  ALTER TABLE "cycles_pricing" DROP COLUMN "pricing_currency";
  ALTER TABLE "programmes" DROP COLUMN "pricing_currency";
  ALTER TABLE "_programmes_v" DROP COLUMN "version_pricing_currency";
  ALTER TABLE "events" DROP COLUMN "pricing_currency";
  ALTER TABLE "_events_v" DROP COLUMN "version_pricing_currency";
  DROP TYPE "public"."enum_courses_pricing_override_currency";
  DROP TYPE "public"."enum__courses_v_version_pricing_override_currency";
  DROP TYPE "public"."enum_cycles_pricing_pricing_currency";
  DROP TYPE "public"."enum_programmes_pricing_currency";
  DROP TYPE "public"."enum__programmes_v_version_pricing_currency";
  DROP TYPE "public"."enum_events_pricing_currency";
  DROP TYPE "public"."enum__events_v_version_pricing_currency";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_courses_pricing_override_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__courses_v_version_pricing_override_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_cycles_pricing_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_programmes_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__programmes_v_version_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum_events_pricing_currency" AS ENUM('EGP');
  CREATE TYPE "public"."enum__events_v_version_pricing_currency" AS ENUM('EGP');
  ALTER TABLE "courses" ADD COLUMN "pricing_override_currency" "enum_courses_pricing_override_currency" DEFAULT 'EGP';
  ALTER TABLE "_courses_v" ADD COLUMN "version_pricing_override_currency" "enum__courses_v_version_pricing_override_currency" DEFAULT 'EGP';
  ALTER TABLE "cycles_pricing" ADD COLUMN "pricing_currency" "enum_cycles_pricing_pricing_currency" DEFAULT 'EGP';
  ALTER TABLE "programmes" ADD COLUMN "pricing_currency" "enum_programmes_pricing_currency" DEFAULT 'EGP';
  ALTER TABLE "_programmes_v" ADD COLUMN "version_pricing_currency" "enum__programmes_v_version_pricing_currency" DEFAULT 'EGP';
  ALTER TABLE "events" ADD COLUMN "pricing_currency" "enum_events_pricing_currency" DEFAULT 'EGP';
  ALTER TABLE "_events_v" ADD COLUMN "version_pricing_currency" "enum__events_v_version_pricing_currency" DEFAULT 'EGP';`)
}
