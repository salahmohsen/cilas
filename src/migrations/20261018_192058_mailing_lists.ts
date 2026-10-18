import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_mailing_lists_members_roles" AS ENUM('super_admin', 'admin', 'fellow', 'member', 'non_degree_seeking');
  CREATE TYPE "public"."enum_mailing_lists_members_course_people" AS ENUM('students', 'fellows');
  CREATE TYPE "public"."enum_mailing_lists_source" AS ENUM('signup', 'members');
  CREATE TABLE "mailing_lists_members_roles" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mailing_lists_members_roles",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "mailing_lists_members_course_people" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_mailing_lists_members_course_people",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "mailing_lists" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"source" "enum_mailing_lists_source" DEFAULT 'members' NOT NULL,
  	"members_everyone" boolean,
  	"segment_id" varchar,
  	"topic_id" varchar,
  	"member_count" numeric,
  	"last_synced" timestamp(3) with time zone,
  	"sync_note" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "mailing_lists_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"programmes_id" integer,
  	"users_id" integer
  );
  
  ALTER TABLE "newsletters" ADD COLUMN "send_to_id" integer;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_send_to_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "mailing_lists_id" integer;
  ALTER TABLE "mailing_lists_members_roles" ADD CONSTRAINT "mailing_lists_members_roles_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mailing_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_lists_members_course_people" ADD CONSTRAINT "mailing_lists_members_course_people_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mailing_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_lists_rels" ADD CONSTRAINT "mailing_lists_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."mailing_lists"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_lists_rels" ADD CONSTRAINT "mailing_lists_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_lists_rels" ADD CONSTRAINT "mailing_lists_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "mailing_lists_rels" ADD CONSTRAINT "mailing_lists_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "mailing_lists_members_roles_order_idx" ON "mailing_lists_members_roles" USING btree ("order");
  CREATE INDEX "mailing_lists_members_roles_parent_idx" ON "mailing_lists_members_roles" USING btree ("parent_id");
  CREATE INDEX "mailing_lists_members_course_people_order_idx" ON "mailing_lists_members_course_people" USING btree ("order");
  CREATE INDEX "mailing_lists_members_course_people_parent_idx" ON "mailing_lists_members_course_people" USING btree ("parent_id");
  CREATE INDEX "mailing_lists_updated_at_idx" ON "mailing_lists" USING btree ("updated_at");
  CREATE INDEX "mailing_lists_created_at_idx" ON "mailing_lists" USING btree ("created_at");
  CREATE INDEX "mailing_lists_rels_order_idx" ON "mailing_lists_rels" USING btree ("order");
  CREATE INDEX "mailing_lists_rels_parent_idx" ON "mailing_lists_rels" USING btree ("parent_id");
  CREATE INDEX "mailing_lists_rels_path_idx" ON "mailing_lists_rels" USING btree ("path");
  CREATE INDEX "mailing_lists_rels_courses_id_idx" ON "mailing_lists_rels" USING btree ("courses_id");
  CREATE INDEX "mailing_lists_rels_programmes_id_idx" ON "mailing_lists_rels" USING btree ("programmes_id");
  CREATE INDEX "mailing_lists_rels_users_id_idx" ON "mailing_lists_rels" USING btree ("users_id");
  ALTER TABLE "newsletters" ADD CONSTRAINT "newsletters_send_to_id_mailing_lists_id_fk" FOREIGN KEY ("send_to_id") REFERENCES "public"."mailing_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_newsletters_v" ADD CONSTRAINT "_newsletters_v_version_send_to_id_mailing_lists_id_fk" FOREIGN KEY ("version_send_to_id") REFERENCES "public"."mailing_lists"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_mailing_lists_fk" FOREIGN KEY ("mailing_lists_id") REFERENCES "public"."mailing_lists"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_send_to_idx" ON "newsletters" USING btree ("send_to_id");
  CREATE INDEX "_newsletters_v_version_version_send_to_idx" ON "_newsletters_v" USING btree ("version_send_to_id");
  CREATE INDEX "payload_locked_documents_rels_mailing_lists_id_idx" ON "payload_locked_documents_rels" USING btree ("mailing_lists_id");
  -- The segment set in Email settings becomes the signup list.
  INSERT INTO "mailing_lists" ("name", "source", "segment_id")
    SELECT 'Public', 'signup', trim("segment_id") FROM "email_settings"
    WHERE coalesce(trim("segment_id"), '') <> '' LIMIT 1;
  ALTER TABLE "email_settings" DROP COLUMN "segment_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   -- The signup list's segment goes back to Email settings.
  ALTER TABLE "email_settings" ADD COLUMN "segment_id" varchar;
  UPDATE "email_settings" SET "segment_id" =
    (SELECT "segment_id" FROM "mailing_lists" WHERE "source" = 'signup' LIMIT 1);
  ALTER TABLE "mailing_lists_members_roles" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mailing_lists_members_course_people" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mailing_lists" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "mailing_lists_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "mailing_lists_members_roles" CASCADE;
  DROP TABLE "mailing_lists_members_course_people" CASCADE;
  DROP TABLE "mailing_lists" CASCADE;
  DROP TABLE "mailing_lists_rels" CASCADE;
  ALTER TABLE "newsletters" DROP CONSTRAINT "newsletters_send_to_id_mailing_lists_id_fk";
  
  ALTER TABLE "_newsletters_v" DROP CONSTRAINT "_newsletters_v_version_send_to_id_mailing_lists_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_mailing_lists_fk";
  
  DROP INDEX "newsletters_send_to_idx";
  DROP INDEX "_newsletters_v_version_version_send_to_idx";
  DROP INDEX "payload_locked_documents_rels_mailing_lists_id_idx";
  ALTER TABLE "newsletters" DROP COLUMN "send_to_id";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_send_to_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "mailing_lists_id";
  DROP TYPE "public"."enum_mailing_lists_members_roles";
  DROP TYPE "public"."enum_mailing_lists_members_course_people";
  DROP TYPE "public"."enum_mailing_lists_source";`)
}
