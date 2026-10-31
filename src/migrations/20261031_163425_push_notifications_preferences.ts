import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Account settings and Web Push: a `reaction` notification kind, the account's
 * notification preferences, and the devices that agreed to push. A device is
 * of no one without its account, so the account's delete clears it (the
 * adapter's default SET NULL cannot apply to a required user).
 */
export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_push_subscriptions_locale" AS ENUM('en', 'ar');
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'reaction' BEFORE 'announcement';
  CREATE TABLE "push_subscriptions" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"endpoint" varchar NOT NULL,
  	"p256dh" varchar NOT NULL,
  	"auth" varchar NOT NULL,
  	"user_agent" varchar,
  	"locale" "enum_push_subscriptions_locale" DEFAULT 'en',
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "notification_preferences" jsonb;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "push_subscriptions_id" integer;
  ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "push_subscriptions_user_idx" ON "push_subscriptions" USING btree ("user_id");
  CREATE UNIQUE INDEX "push_subscriptions_endpoint_idx" ON "push_subscriptions" USING btree ("endpoint");
  CREATE INDEX "push_subscriptions_updated_at_idx" ON "push_subscriptions" USING btree ("updated_at");
  CREATE INDEX "push_subscriptions_created_at_idx" ON "push_subscriptions" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk" FOREIGN KEY ("push_subscriptions_id") REFERENCES "public"."push_subscriptions"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_push_subscriptions_id_idx" ON "payload_locked_documents_rels" USING btree ("push_subscriptions_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "push_subscriptions" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "push_subscriptions" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_push_subscriptions_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('submitted', 'approved', 'changes_requested', 'rejected', 'removed', 'application', 'mention', 'comment', 'reply', 'announcement', 'moderation', 'report', 'question', 'event_changed');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "payload_locked_documents_rels_push_subscriptions_id_idx";
  ALTER TABLE "users" DROP COLUMN "notification_preferences";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "push_subscriptions_id";
  DROP TYPE "public"."enum_push_subscriptions_locale";`)
}
