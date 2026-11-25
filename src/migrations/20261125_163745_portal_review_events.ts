import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_review_events_collection" AS ENUM('articles', 'courses', 'publications');
  CREATE TYPE "public"."enum_review_events_from" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum_review_events_to" AS ENUM('draft', 'submitted', 'changes_requested', 'approved', 'rejected');
  CREATE TYPE "public"."enum_review_events_request" AS ENUM('changes', 'removal');
  CREATE TABLE "review_events" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"collection" "enum_review_events_collection" NOT NULL,
  	"doc" numeric NOT NULL,
  	"version" numeric,
  	"from" "enum_review_events_from" NOT NULL,
  	"to" "enum_review_events_to" NOT NULL,
  	"request" "enum_review_events_request",
  	"note" varchar,
  	"actor_id" integer,
  	"at" timestamp(3) with time zone NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "review_events_id" integer;
  ALTER TABLE "review_events" ADD CONSTRAINT "review_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "review_events_doc_idx" ON "review_events" USING btree ("doc");
  CREATE INDEX "review_events_actor_idx" ON "review_events" USING btree ("actor_id");
  CREATE INDEX "collection_doc_idx" ON "review_events" USING btree ("collection","doc");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_review_events_fk" FOREIGN KEY ("review_events_id") REFERENCES "public"."review_events"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_review_events_id_idx" ON "payload_locked_documents_rels" USING btree ("review_events_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "review_events" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "review_events" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_review_events_fk";
  
  DROP INDEX "payload_locked_documents_rels_review_events_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "review_events_id";
  DROP TYPE "public"."enum_review_events_collection";
  DROP TYPE "public"."enum_review_events_from";
  DROP TYPE "public"."enum_review_events_to";
  DROP TYPE "public"."enum_review_events_request";`)
}
