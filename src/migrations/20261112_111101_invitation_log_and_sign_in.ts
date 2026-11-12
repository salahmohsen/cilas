import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "invitation_log" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users" ADD COLUMN "activated_at" timestamp(3) with time zone;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "invitation_log_id" integer;
  ALTER TABLE "invitation_log" ADD CONSTRAINT "invitation_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "invitation_log_user_idx" ON "invitation_log" USING btree ("user_id");
  CREATE INDEX "invitation_log_updated_at_idx" ON "invitation_log" USING btree ("updated_at");
  CREATE INDEX "invitation_log_created_at_idx" ON "invitation_log" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_invitation_log_fk" FOREIGN KEY ("invitation_log_id") REFERENCES "public"."invitation_log"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_invitation_log_id_idx" ON "payload_locked_documents_rels" USING btree ("invitation_log_id");`)
  // Accounts already in use: a Google id, or a sign-in session. The others
  // count as not signed in yet, so an invitation reaches them.
  await db.execute(sql`
   UPDATE "users" SET "activated_at" = COALESCE(
     (SELECT min("created_at") FROM "users_sessions" WHERE "_parent_id" = "users"."id"),
     now()
   )
   WHERE "sub" IS NOT NULL
      OR EXISTS (SELECT 1 FROM "users_sessions" WHERE "_parent_id" = "users"."id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "invitation_log" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "invitation_log" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_invitation_log_fk";
  
  DROP INDEX "payload_locked_documents_rels_invitation_log_id_idx";
  ALTER TABLE "users" DROP COLUMN "activated_at";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "invitation_log_id";`)
}
