import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'mention';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'comment';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'reply';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'announcement';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'moderation';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'report';
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'question';`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('submitted', 'approved', 'changes_requested', 'rejected', 'application');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";`)
}
