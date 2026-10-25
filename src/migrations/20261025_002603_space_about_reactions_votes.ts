import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_space_reactions_reaction" ADD VALUE 'celebrate' BEFORE 'insightful';
  ALTER TYPE "public"."enum_space_reactions_reaction" ADD VALUE 'rocket';
  CREATE TABLE "spaces_locales" (
  	"about" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "space_posts" ADD COLUMN "vote_anonymous" boolean DEFAULT false;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_vote_anonymous" boolean DEFAULT false;
  ALTER TABLE "spaces_locales" ADD CONSTRAINT "spaces_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."spaces"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "spaces_locales_locale_parent_id_unique" ON "spaces_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "spaces_locales_parent_id_idx" ON "spaces_locales" USING btree ("_parent_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "spaces_locales" CASCADE;
  ALTER TABLE "space_reactions" ALTER COLUMN "reaction" SET DATA TYPE text;
  DROP TYPE "public"."enum_space_reactions_reaction";
  CREATE TYPE "public"."enum_space_reactions_reaction" AS ENUM('agree', 'thank_you', 'insightful', 'same_question');
  ALTER TABLE "space_reactions" ALTER COLUMN "reaction" SET DATA TYPE "public"."enum_space_reactions_reaction" USING "reaction"::"public"."enum_space_reactions_reaction";
  ALTER TABLE "space_posts" DROP COLUMN "vote_anonymous";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_vote_anonymous";`)
}
