import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_space_reactions_reaction" AS ENUM('agree', 'thank_you', 'insightful', 'same_question');
  CREATE TYPE "public"."enum_space_preferences_digest" AS ENUM('daily', 'weekly', 'off');
  ALTER TABLE "space_reactions" ADD COLUMN "space_id" integer NOT NULL;
  ALTER TABLE "space_reactions" ADD COLUMN "account_id" integer NOT NULL;
  ALTER TABLE "space_reactions" ADD COLUMN "post_id" integer;
  ALTER TABLE "space_reactions" ADD COLUMN "comment_id" integer;
  ALTER TABLE "space_reactions" ADD COLUMN "reaction" "enum_space_reactions_reaction" NOT NULL;
  ALTER TABLE "space_consents" ADD COLUMN "account_id" integer NOT NULL;
  ALTER TABLE "space_consents" ADD COLUMN "version" numeric NOT NULL;
  ALTER TABLE "space_consents" ADD COLUMN "accepted_at" timestamp(3) with time zone NOT NULL;
  ALTER TABLE "space_visits" ADD COLUMN "account_id" integer NOT NULL;
  ALTER TABLE "space_visits" ADD COLUMN "space_id" integer NOT NULL;
  ALTER TABLE "space_visits" ADD COLUMN "last_visited_at" timestamp(3) with time zone NOT NULL;
  ALTER TABLE "space_visits" ADD COLUMN "saw_privacy" boolean DEFAULT false;
  ALTER TABLE "space_visits" ADD COLUMN "introduced" boolean DEFAULT false;
  ALTER TABLE "space_visits" ADD COLUMN "read_pinned" boolean DEFAULT false;
  ALTER TABLE "space_visits" ADD COLUMN "checked_profile" boolean DEFAULT false;
  ALTER TABLE "space_visits" ADD COLUMN "chose_digest" boolean DEFAULT false;
  ALTER TABLE "space_preferences" ADD COLUMN "account_id" integer NOT NULL;
  ALTER TABLE "space_preferences" ADD COLUMN "digest" "enum_space_preferences_digest" DEFAULT 'daily' NOT NULL;
  ALTER TABLE "space_reactions" ADD CONSTRAINT "space_reactions_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_reactions" ADD CONSTRAINT "space_reactions_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_reactions" ADD CONSTRAINT "space_reactions_post_id_space_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."space_posts"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_reactions" ADD CONSTRAINT "space_reactions_comment_id_space_comments_id_fk" FOREIGN KEY ("comment_id") REFERENCES "public"."space_comments"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_consents" ADD CONSTRAINT "space_consents_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_visits" ADD CONSTRAINT "space_visits_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "space_preferences" ADD CONSTRAINT "space_preferences_account_id_users_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_reactions_space_idx" ON "space_reactions" USING btree ("space_id");
  CREATE INDEX "space_reactions_account_idx" ON "space_reactions" USING btree ("account_id");
  CREATE INDEX "space_reactions_post_idx" ON "space_reactions" USING btree ("post_id");
  CREATE INDEX "space_reactions_comment_idx" ON "space_reactions" USING btree ("comment_id");
  CREATE UNIQUE INDEX "account_post_reaction_idx" ON "space_reactions" USING btree ("account_id","post_id","reaction");
  CREATE UNIQUE INDEX "account_comment_reaction_idx" ON "space_reactions" USING btree ("account_id","comment_id","reaction");
  CREATE INDEX "space_consents_account_idx" ON "space_consents" USING btree ("account_id");
  CREATE UNIQUE INDEX "account_version_idx" ON "space_consents" USING btree ("account_id","version");
  CREATE INDEX "space_visits_account_idx" ON "space_visits" USING btree ("account_id");
  CREATE INDEX "space_visits_space_idx" ON "space_visits" USING btree ("space_id");
  CREATE UNIQUE INDEX "account_space_idx" ON "space_visits" USING btree ("account_id","space_id");
  CREATE INDEX "space_preferences_account_idx" ON "space_preferences" USING btree ("account_id");
  CREATE UNIQUE INDEX "account_idx" ON "space_preferences" USING btree ("account_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_reactions" DROP CONSTRAINT "space_reactions_space_id_spaces_id_fk";
  
  ALTER TABLE "space_reactions" DROP CONSTRAINT "space_reactions_account_id_users_id_fk";
  
  ALTER TABLE "space_reactions" DROP CONSTRAINT "space_reactions_post_id_space_posts_id_fk";
  
  ALTER TABLE "space_reactions" DROP CONSTRAINT "space_reactions_comment_id_space_comments_id_fk";
  
  ALTER TABLE "space_consents" DROP CONSTRAINT "space_consents_account_id_users_id_fk";
  
  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_account_id_users_id_fk";
  
  ALTER TABLE "space_visits" DROP CONSTRAINT "space_visits_space_id_spaces_id_fk";
  
  ALTER TABLE "space_preferences" DROP CONSTRAINT "space_preferences_account_id_users_id_fk";
  
  DROP INDEX "space_reactions_space_idx";
  DROP INDEX "space_reactions_account_idx";
  DROP INDEX "space_reactions_post_idx";
  DROP INDEX "space_reactions_comment_idx";
  DROP INDEX "account_post_reaction_idx";
  DROP INDEX "account_comment_reaction_idx";
  DROP INDEX "space_consents_account_idx";
  DROP INDEX "account_version_idx";
  DROP INDEX "space_visits_account_idx";
  DROP INDEX "space_visits_space_idx";
  DROP INDEX "account_space_idx";
  DROP INDEX "space_preferences_account_idx";
  DROP INDEX "account_idx";
  ALTER TABLE "space_reactions" DROP COLUMN "space_id";
  ALTER TABLE "space_reactions" DROP COLUMN "account_id";
  ALTER TABLE "space_reactions" DROP COLUMN "post_id";
  ALTER TABLE "space_reactions" DROP COLUMN "comment_id";
  ALTER TABLE "space_reactions" DROP COLUMN "reaction";
  ALTER TABLE "space_consents" DROP COLUMN "account_id";
  ALTER TABLE "space_consents" DROP COLUMN "version";
  ALTER TABLE "space_consents" DROP COLUMN "accepted_at";
  ALTER TABLE "space_visits" DROP COLUMN "account_id";
  ALTER TABLE "space_visits" DROP COLUMN "space_id";
  ALTER TABLE "space_visits" DROP COLUMN "last_visited_at";
  ALTER TABLE "space_visits" DROP COLUMN "saw_privacy";
  ALTER TABLE "space_visits" DROP COLUMN "introduced";
  ALTER TABLE "space_visits" DROP COLUMN "read_pinned";
  ALTER TABLE "space_visits" DROP COLUMN "checked_profile";
  ALTER TABLE "space_visits" DROP COLUMN "chose_digest";
  ALTER TABLE "space_preferences" DROP COLUMN "account_id";
  ALTER TABLE "space_preferences" DROP COLUMN "digest";
  DROP TYPE "public"."enum_space_reactions_reaction";
  DROP TYPE "public"."enum_space_preferences_digest";`)
}
