import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "space_rules" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone,
  	"created_at" timestamp(3) with time zone
  );
  
  CREATE TABLE "space_rules_locales" (
  	"privacy_rules" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "spaces_locales" ADD COLUMN "privacy_rules" varchar;
  ALTER TABLE "space_posts" ADD COLUMN "vote_closes_at" timestamp(3) with time zone;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_vote_closes_at" timestamp(3) with time zone;
  ALTER TABLE "space_rules_locales" ADD CONSTRAINT "space_rules_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."space_rules"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "space_rules_locales_locale_parent_id_unique" ON "space_rules_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "space_rules_locales_parent_id_idx" ON "space_rules_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "space_rules" CASCADE;
  DROP TABLE "space_rules_locales" CASCADE;
  ALTER TABLE "spaces_locales" DROP COLUMN "privacy_rules";
  ALTER TABLE "space_posts" DROP COLUMN "vote_closes_at";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_vote_closes_at";`)
}
