import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_notifications_kind" ADD VALUE IF NOT EXISTS 'removed';
  ALTER TABLE "notifications" ADD COLUMN "description" varchar;
  ALTER TABLE "notifications" ADD COLUMN "actor_name" varchar;
  ALTER TABLE "notifications" ADD COLUMN "actor_photo" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notifications" DROP COLUMN "description";
  ALTER TABLE "notifications" DROP COLUMN "actor_name";
  ALTER TABLE "notifications" DROP COLUMN "actor_photo";`)
}
