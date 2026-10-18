import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "newsletters_picks" CASCADE;
  DROP TABLE "_newsletters_v_version_picks" CASCADE;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "newsletters_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"note" varchar
  );
  
  CREATE TABLE "_newsletters_v_version_picks" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"note" varchar,
  	"_uuid" varchar
  );
  
  ALTER TABLE "newsletters_picks" ADD CONSTRAINT "newsletters_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."newsletters"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_newsletters_v_version_picks" ADD CONSTRAINT "_newsletters_v_version_picks_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_newsletters_v"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "newsletters_picks_order_idx" ON "newsletters_picks" USING btree ("_order");
  CREATE INDEX "newsletters_picks_parent_id_idx" ON "newsletters_picks" USING btree ("_parent_id");
  CREATE INDEX "_newsletters_v_version_picks_order_idx" ON "_newsletters_v_version_picks" USING btree ("_order");
  CREATE INDEX "_newsletters_v_version_picks_parent_id_idx" ON "_newsletters_v_version_picks" USING btree ("_parent_id");`)
}
