import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_spaces_events" AS ENUM('members', 'moderators');
  ALTER TYPE "public"."enum_space_posts_kind" ADD VALUE 'event';
  ALTER TYPE "public"."enum_space_posts_kind" ADD VALUE 'vote';
  ALTER TYPE "public"."enum__space_posts_v_version_kind" ADD VALUE 'event';
  ALTER TYPE "public"."enum__space_posts_v_version_kind" ADD VALUE 'vote';
  CREATE TABLE "space_posts_vote_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar
  );
  
  CREATE TABLE "_space_posts_v_version_vote_options" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "space_votes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"space_id" integer NOT NULL,
  	"account_id" integer NOT NULL,
  	"post_id" integer NOT NULL,
  	"option" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "spaces" ADD COLUMN "events" "enum_spaces_events" DEFAULT 'members';
  ALTER TABLE "space_posts" ADD COLUMN "event_location" varchar;
  ALTER TABLE "space_posts" ADD COLUMN "event_starts_at" timestamp(3) with time zone;
  ALTER TABLE "space_posts" ADD COLUMN "vote_multiple" boolean DEFAULT false;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_location" varchar;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_event_starts_at" timestamp(3) with time zone;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_vote_multiple" boolean DEFAULT false;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "space_votes_id" integer;
  ALTER TABLE "space_posts_vote_options" ADD CONSTRAINT "space_posts_vote_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."space_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_space_posts_v_version_vote_options" ADD CONSTRAINT "_space_posts_v_version_vote_options_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_space_posts_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "space_votes" ADD CONSTRAINT "space_votes_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_votes" ADD CONSTRAINT "space_votes_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_votes" ADD CONSTRAINT "space_votes_post_id_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_posts_vote_options_order_idx" ON "space_posts_vote_options" USING btree ("_order");
  CREATE INDEX "space_posts_vote_options_parent_id_idx" ON "space_posts_vote_options" USING btree ("_parent_id");
  CREATE INDEX "_space_posts_v_version_vote_options_order_idx" ON "_space_posts_v_version_vote_options" USING btree ("_order");
  CREATE INDEX "_space_posts_v_version_vote_options_parent_id_idx" ON "_space_posts_v_version_vote_options" USING btree ("_parent_id");
  CREATE INDEX "space_votes_space_idx" ON "space_votes" USING btree ("space_id");
  CREATE INDEX "space_votes_account_idx" ON "space_votes" USING btree ("account_id");
  CREATE INDEX "space_votes_post_idx" ON "space_votes" USING btree ("post_id");
  CREATE INDEX "space_votes_updated_at_idx" ON "space_votes" USING btree ("updated_at");
  CREATE INDEX "space_votes_created_at_idx" ON "space_votes" USING btree ("created_at");
  CREATE UNIQUE INDEX "account_post_option_idx" ON "space_votes" USING btree ("account_id","post_id","option");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_space_votes_fk" FOREIGN KEY ("space_votes_id") REFERENCES "public"."space_votes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_space_votes_id_idx" ON "payload_locked_documents_rels" USING btree ("space_votes_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts_vote_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_space_posts_v_version_vote_options" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "space_votes" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "space_posts_vote_options" CASCADE;
  DROP TABLE "_space_posts_v_version_vote_options" CASCADE;
  DROP TABLE "space_votes" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_space_votes_fk";
  
  ALTER TABLE "space_posts" ALTER COLUMN "kind" SET DATA TYPE text;
  ALTER TABLE "space_posts" ALTER COLUMN "kind" SET DEFAULT 'discussion'::text;
  DROP TYPE "public"."enum_space_posts_kind";
  CREATE TYPE "public"."enum_space_posts_kind" AS ENUM('discussion', 'question', 'announcement');
  ALTER TABLE "space_posts" ALTER COLUMN "kind" SET DEFAULT 'discussion'::"public"."enum_space_posts_kind";
  ALTER TABLE "space_posts" ALTER COLUMN "kind" SET DATA TYPE "public"."enum_space_posts_kind" USING "kind"::"public"."enum_space_posts_kind";
  ALTER TABLE "_space_posts_v" ALTER COLUMN "version_kind" SET DATA TYPE text;
  ALTER TABLE "_space_posts_v" ALTER COLUMN "version_kind" SET DEFAULT 'discussion'::text;
  DROP TYPE "public"."enum__space_posts_v_version_kind";
  CREATE TYPE "public"."enum__space_posts_v_version_kind" AS ENUM('discussion', 'question', 'announcement');
  ALTER TABLE "_space_posts_v" ALTER COLUMN "version_kind" SET DEFAULT 'discussion'::"public"."enum__space_posts_v_version_kind";
  ALTER TABLE "_space_posts_v" ALTER COLUMN "version_kind" SET DATA TYPE "public"."enum__space_posts_v_version_kind" USING "version_kind"::"public"."enum__space_posts_v_version_kind";
  DROP INDEX "payload_locked_documents_rels_space_votes_id_idx";
  ALTER TABLE "spaces" DROP COLUMN "events";
  ALTER TABLE "space_posts" DROP COLUMN "event_location";
  ALTER TABLE "space_posts" DROP COLUMN "event_starts_at";
  ALTER TABLE "space_posts" DROP COLUMN "vote_multiple";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_location";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_event_starts_at";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_vote_multiple";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "space_votes_id";
  DROP TYPE "public"."enum_spaces_events";`)
}
