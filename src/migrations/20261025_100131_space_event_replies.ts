import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_space_rsvps_status" AS ENUM('going', 'maybe', 'not_going');
  ALTER TYPE "public"."enum_notifications_kind" ADD VALUE 'event_changed';
  CREATE TABLE "space_rsvps" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"space_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"post_id" integer NOT NULL,
  	"status" "enum_space_rsvps_status" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "space_posts" ADD COLUMN "event_ends_at" timestamp(3) with time zone;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_ends_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_rsvps_id" integer;
  ALTER TABLE "space_rsvps" ADD CONSTRAINT "space_rsvps_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_rsvps" ADD CONSTRAINT "space_rsvps_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_rsvps" ADD CONSTRAINT "space_rsvps_post_id_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_rsvps_space_idx" ON "space_rsvps" USING btree ("space_id");
  CREATE INDEX "space_rsvps_account_idx" ON "space_rsvps" USING btree ("account_id");
  CREATE INDEX "space_rsvps_post_idx" ON "space_rsvps" USING btree ("post_id");
  CREATE INDEX "space_rsvps_updated_at_idx" ON "space_rsvps" USING btree ("updated_at");
  CREATE INDEX "space_rsvps_created_at_idx" ON "space_rsvps" USING btree ("created_at");
  CREATE UNIQUE INDEX "account_post_idx" ON "space_rsvps" USING btree ("account_id","post_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_rsvps_fk" FOREIGN KEY ("space_rsvps_id") REFERENCES "public"."space_rsvps"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_space_rsvps_id_idx" ON "payload_locked_documents_rels" USING btree ("space_rsvps_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_rsvps" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "space_rsvps" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_rsvps_fk";
  
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE text;
  DROP TYPE "public"."enum_notifications_kind";
  CREATE TYPE "public"."enum_notifications_kind" AS ENUM('submitted', 'approved', 'changes_requested', 'rejected', 'removed', 'application', 'mention', 'comment', 'reply', 'announcement', 'moderation', 'report', 'question');
  ALTER TABLE "notifications" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_notifications_kind" USING "kind"::"public"."enum_notifications_kind";
  DROP INDEX "payload_locked_documents_rels_space_rsvps_id_idx";
  ALTER TABLE "space_posts" DROP COLUMN "event_ends_at";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_ends_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_rsvps_id";
  DROP TYPE "public"."enum_space_rsvps_status";`)
}
