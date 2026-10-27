import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" ADD COLUMN "pinned_full" boolean DEFAULT false;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_pinned_full" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" DROP COLUMN "pinned_full";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_pinned_full";`)
}
