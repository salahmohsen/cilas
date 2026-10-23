import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_space_posts_kind" AS ENUM('discussion', 'question', 'announcement');
  CREATE TYPE "public"."enum__space_posts_v_version_kind" AS ENUM('discussion', 'question', 'announcement');
  CREATE TABLE "_space_posts_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_space_id" integer NOT NULL,
  	"version_author_id" integer,
  	"version_kind" "enum__space_posts_v_version_kind" DEFAULT 'discussion' NOT NULL,
  	"version_body" varchar NOT NULL,
  	"version_pinned" boolean DEFAULT false,
  	"version_locked" boolean DEFAULT false,
  	"version_announcement_email_sent" boolean DEFAULT false,
  	"version_edited_at" timestamp(3) with time zone,
  	"version_last_activity_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "_space_comments_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_space_id" integer NOT NULL,
  	"version_post_id" integer NOT NULL,
  	"version_parent_id" integer,
  	"version_author_id" integer,
  	"version_body" varchar NOT NULL,
  	"version_edited_at" timestamp(3) with time zone,
  	"version_deleted_at" timestamp(3) with time zone,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "space_posts" ALTER COLUMN "space_id" SET NOT NULL;
  ALTER TABLE "space_posts" ADD COLUMN "author_id" integer;
  ALTER TABLE "space_posts" ADD COLUMN "kind" "enum_space_posts_kind" DEFAULT 'discussion' NOT NULL;
  ALTER TABLE "space_posts" ADD COLUMN "body" varchar NOT NULL;
  ALTER TABLE "space_posts" ADD COLUMN "pinned" boolean DEFAULT false;
  ALTER TABLE "space_posts" ADD COLUMN "locked" boolean DEFAULT false;
  ALTER TABLE "space_posts" ADD COLUMN "announcement_email_sent" boolean DEFAULT false;
  ALTER TABLE "space_posts" ADD COLUMN "edited_at" timestamp(3) with time zone;
  ALTER TABLE "space_posts" ADD COLUMN "last_activity_at" timestamp(3) with time zone;
  ALTER TABLE "space_posts" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "space_comments" ADD COLUMN "space_id" integer NOT NULL;
  ALTER TABLE "space_comments" ADD COLUMN "post_id" integer NOT NULL;
  ALTER TABLE "space_comments" ADD COLUMN "parent_id" integer;
  ALTER TABLE "space_comments" ADD COLUMN "author_id" integer;
  ALTER TABLE "space_comments" ADD COLUMN "body" varchar NOT NULL;
  ALTER TABLE "space_comments" ADD COLUMN "edited_at" timestamp(3) with time zone;
  ALTER TABLE "space_comments" ADD COLUMN "deleted_at" timestamp(3) with time zone;
  ALTER TABLE "_space_posts_v" ADD CONSTRAINT "_space_posts_v_parent_id_space_posts_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_posts_v" ADD CONSTRAINT "_space_posts_v_version_space_id_spaces_id_fk" FOREIGN KEY ("version_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_posts_v" ADD CONSTRAINT "_space_posts_v_version_author_id_people_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_comments_v" ADD CONSTRAINT "_space_comments_v_parent_id_space_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."space_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_comments_v" ADD CONSTRAINT "_space_comments_v_version_space_id_spaces_id_fk" FOREIGN KEY ("version_space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_comments_v" ADD CONSTRAINT "_space_comments_v_version_post_id_space_posts_id_fk" FOREIGN KEY ("version_post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_comments_v" ADD CONSTRAINT "_space_comments_v_version_parent_id_space_comments_id_fk" FOREIGN KEY ("version_parent_id") REFERENCES "public"."space_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_space_comments_v" ADD CONSTRAINT "_space_comments_v_version_author_id_people_id_fk" FOREIGN KEY ("version_author_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "_space_posts_v_parent_idx" ON "_space_posts_v" USING btree ("parent_id");
  CREATE INDEX "_space_posts_v_version_version_space_idx" ON "_space_posts_v" USING btree ("version_space_id");
  CREATE INDEX "_space_posts_v_version_version_author_idx" ON "_space_posts_v" USING btree ("version_author_id");
  CREATE INDEX "_space_posts_v_version_version_pinned_idx" ON "_space_posts_v" USING btree ("version_pinned");
  CREATE INDEX "_space_posts_v_version_version_last_activity_at_idx" ON "_space_posts_v" USING btree ("version_last_activity_at");
  CREATE INDEX "_space_posts_v_version_version_deleted_at_idx" ON "_space_posts_v" USING btree ("version_deleted_at");
  CREATE INDEX "_space_posts_v_version_version_updated_at_idx" ON "_space_posts_v" USING btree ("version_updated_at");
  CREATE INDEX "_space_posts_v_version_version_created_at_idx" ON "_space_posts_v" USING btree ("version_created_at");
  CREATE INDEX "_space_posts_v_created_at_idx" ON "_space_posts_v" USING btree ("created_at");
  CREATE INDEX "_space_posts_v_updated_at_idx" ON "_space_posts_v" USING btree ("updated_at");
  CREATE INDEX "_space_comments_v_parent_idx" ON "_space_comments_v" USING btree ("parent_id");
  CREATE INDEX "_space_comments_v_version_version_space_idx" ON "_space_comments_v" USING btree ("version_space_id");
  CREATE INDEX "_space_comments_v_version_version_post_idx" ON "_space_comments_v" USING btree ("version_post_id");
  CREATE INDEX "_space_comments_v_version_version_parent_idx" ON "_space_comments_v" USING btree ("version_parent_id");
  CREATE INDEX "_space_comments_v_version_version_author_idx" ON "_space_comments_v" USING btree ("version_author_id");
  CREATE INDEX "_space_comments_v_version_version_deleted_at_idx" ON "_space_comments_v" USING btree ("version_deleted_at");
  CREATE INDEX "_space_comments_v_version_version_updated_at_idx" ON "_space_comments_v" USING btree ("version_updated_at");
  CREATE INDEX "_space_comments_v_version_version_created_at_idx" ON "_space_comments_v" USING btree ("version_created_at");
  CREATE INDEX "_space_comments_v_created_at_idx" ON "_space_comments_v" USING btree ("created_at");
  CREATE INDEX "_space_comments_v_updated_at_idx" ON "_space_comments_v" USING btree ("updated_at");
  ALTER TABLE "space_posts" ADD CONSTRAINT "space_posts_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_comments" ADD CONSTRAINT "space_comments_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_comments" ADD CONSTRAINT "space_comments_post_id_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_comments" ADD CONSTRAINT "space_comments_parent_id_space_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."space_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_comments" ADD CONSTRAINT "space_comments_author_id_people_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_posts_author_idx" ON "space_posts" USING btree ("author_id");
  CREATE INDEX "space_posts_pinned_idx" ON "space_posts" USING btree ("pinned");
  CREATE INDEX "space_posts_last_activity_at_idx" ON "space_posts" USING btree ("last_activity_at");
  CREATE INDEX "space_posts_deleted_at_idx" ON "space_posts" USING btree ("deleted_at");
  CREATE INDEX "space_comments_space_idx" ON "space_comments" USING btree ("space_id");
  CREATE INDEX "space_comments_post_idx" ON "space_comments" USING btree ("post_id");
  CREATE INDEX "space_comments_parent_idx" ON "space_comments" USING btree ("parent_id");
  CREATE INDEX "space_comments_author_idx" ON "space_comments" USING btree ("author_id");
  CREATE INDEX "space_comments_deleted_at_idx" ON "space_comments" USING btree ("deleted_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_space_posts_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_space_comments_v" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "_space_posts_v" CASCADE;
  DROP TABLE "_space_comments_v" CASCADE;
  ALTER TABLE "space_posts" DROP CONSTRAINT "space_posts_author_id_people_id_fk";
  
  ALTER TABLE "space_comments" DROP CONSTRAINT "space_comments_space_id_spaces_id_fk";
  
  ALTER TABLE "space_comments" DROP CONSTRAINT "space_comments_post_id_space_posts_id_fk";
  
  ALTER TABLE "space_comments" DROP CONSTRAINT "space_comments_parent_id_space_comments_id_fk";
  
  ALTER TABLE "space_comments" DROP CONSTRAINT "space_comments_author_id_people_id_fk";
  
  DROP INDEX "space_posts_author_idx";
  DROP INDEX "space_posts_pinned_idx";
  DROP INDEX "space_posts_last_activity_at_idx";
  DROP INDEX "space_posts_deleted_at_idx";
  DROP INDEX "space_comments_space_idx";
  DROP INDEX "space_comments_post_idx";
  DROP INDEX "space_comments_parent_idx";
  DROP INDEX "space_comments_author_idx";
  DROP INDEX "space_comments_deleted_at_idx";
  ALTER TABLE "space_posts" ALTER COLUMN "space_id" DROP NOT NULL;
  ALTER TABLE "space_posts" DROP COLUMN "author_id";
  ALTER TABLE "space_posts" DROP COLUMN "kind";
  ALTER TABLE "space_posts" DROP COLUMN "body";
  ALTER TABLE "space_posts" DROP COLUMN "pinned";
  ALTER TABLE "space_posts" DROP COLUMN "locked";
  ALTER TABLE "space_posts" DROP COLUMN "announcement_email_sent";
  ALTER TABLE "space_posts" DROP COLUMN "edited_at";
  ALTER TABLE "space_posts" DROP COLUMN "last_activity_at";
  ALTER TABLE "space_posts" DROP COLUMN "deleted_at";
  ALTER TABLE "space_comments" DROP COLUMN "space_id";
  ALTER TABLE "space_comments" DROP COLUMN "post_id";
  ALTER TABLE "space_comments" DROP COLUMN "parent_id";
  ALTER TABLE "space_comments" DROP COLUMN "author_id";
  ALTER TABLE "space_comments" DROP COLUMN "body";
  ALTER TABLE "space_comments" DROP COLUMN "edited_at";
  ALTER TABLE "space_comments" DROP COLUMN "deleted_at";
  DROP TYPE "public"."enum_space_posts_kind";
  DROP TYPE "public"."enum__space_posts_v_version_kind";`)
}
