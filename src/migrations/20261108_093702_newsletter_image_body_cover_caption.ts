import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters_blocks_image" ADD COLUMN "body" jsonb;
  ALTER TABLE "newsletters" ADD COLUMN "cover_caption" varchar;
  ALTER TABLE "_newsletters_v_blocks_image" ADD COLUMN "body" jsonb;
  ALTER TABLE "_newsletters_v" ADD COLUMN "version_cover_caption" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "newsletters_blocks_image" DROP COLUMN "body";
  ALTER TABLE "newsletters" DROP COLUMN "cover_caption";
  ALTER TABLE "_newsletters_v_blocks_image" DROP COLUMN "body";
  ALTER TABLE "_newsletters_v" DROP COLUMN "version_cover_caption";`)
}
