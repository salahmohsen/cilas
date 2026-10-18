import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "newsletters_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "newsletters_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"articles_id" integer,
  	"programmes_id" integer
  );
  
  CREATE TABLE "_newsletters_v_version_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  CREATE TABLE "_newsletters_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"courses_id" integer,
  	"articles_id" integer,
  	"programmes_id" integer
  );
  
  ALTER TABLE "newsletters" ADD COLUMN "preheader" varchar;
  ALTER TABLE "newsletters" ADD COLUMN "sent_at" timestamp(3) with time zone;
  ALTER TABLE "newsletters" ADD COLUMN "broadcast_id" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_preheader" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_sent_at" timestamp(3) with time zone;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_broadcast_id" varchar;
  ALTER TABLE "_newsletters_v" ADD COLUMN "autosave" boolean;
  ALTER TABLE "newsletters_picks" ADD CONSTRAINT "newsletters_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "newsletters_rels" ADD CONSTRAINT "newsletters_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_version_picks" ADD CONSTRAINT "_newsletters_v_version_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_courses_fk" FOREIGN KEY ("courses_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_articles_fk" FOREIGN KEY ("articles_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_rels" ADD CONSTRAINT "_newsletters_v_rels_programmes_fk" FOREIGN KEY ("programmes_id") REFERENCES "public"."programmes"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_picks_order_idx" ON "newsletters_picks" USING btree ("_order");
  CREATE INDEX "newsletters_picks_parent_id_idx" ON "newsletters_picks" USING btree ("_parent_id");
  CREATE INDEX "newsletters_rels_order_idx" ON "newsletters_rels" USING btree ("order");
  CREATE INDEX "newsletters_rels_parent_idx" ON "newsletters_rels" USING btree ("parent_id");
  CREATE INDEX "newsletters_rels_path_idx" ON "newsletters_rels" USING btree ("path");
  CREATE INDEX "newsletters_rels_courses_id_idx" ON "newsletters_rels" USING btree ("courses_id");
  CREATE INDEX "newsletters_rels_articles_id_idx" ON "newsletters_rels" USING btree ("articles_id");
  CREATE INDEX "newsletters_rels_programmes_id_idx" ON "newsletters_rels" USING btree ("programmes_id");
  CREATE INDEX "_newsletters_v_version_picks_order_idx" ON "_newsletters_v_version_picks" USING btree ("_order");
  CREATE INDEX "_newsletters_v_version_picks_parent_id_idx" ON "_newsletters_v_version_picks" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_rels_order_idx" ON "_newsletters_v_rels" USING btree ("order");
  CREATE INDEX "_newsletters_v_rels_parent_idx" ON "_newsletters_v_rels" USING btree ("parent_id");
  CREATE INDEX "_newsletters_v_rels_path_idx" ON "_newsletters_v_rels" USING btree ("path");
  CREATE INDEX "_newsletters_v_rels_courses_id_idx" ON "_newsletters_v_rels" USING btree ("courses_id");
  CREATE INDEX "_newsletters_v_rels_articles_id_idx" ON "_newsletters_v_rels" USING btree ("articles_id");
  CREATE INDEX "_newsletters_v_rels_programmes_id_idx" ON "_newsletters_v_rels" USING btree ("programmes_id");
  CREATE INDEX "_newsletters_v_autosave_idx" ON "_newsletters_v" USING btree ("autosave");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "newsletters_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_version_picks" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_newsletters_v_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "newsletters_picks" CASCADE;
  DROP TABLE "newsletters_rels" CASCADE;
  DROP TABLE "_newsletters_v_version_picks" CASCADE;
  DROP TABLE "_newsletters_v_rels" CASCADE;
  DROP INDEX "_newsletters_v_autosave_idx";
  ALTER TABLE "newsletters" DROP COLUMN "preheader";
  ALTER TABLE "newsletters" DROP COLUMN "sent_at";
  ALTER TABLE "newsletters" DROP COLUMN "broadcast_id";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_preheader";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_sent_at";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_broadcast_id";
  ALTER TABLE "_newsletters_v" DROP COLUMN "autosave";`)
}
