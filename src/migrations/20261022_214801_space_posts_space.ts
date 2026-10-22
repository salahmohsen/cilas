import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" ADD COLUMN "space_id" integer;
  ALTER TABLE "space_posts" ADD CONSTRAINT "space_posts_space_id_spaces_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."spaces"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "space_posts_space_idx" ON "space_posts" USING btree ("space_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" DROP CONSTRAINT "space_posts_space_id_spaces_id_fk";
  
  DROP INDEX "space_posts_space_idx";
  ALTER TABLE "space_posts" DROP COLUMN "space_id";`)
}
