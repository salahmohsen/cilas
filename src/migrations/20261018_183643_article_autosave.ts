import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "_articles_v" ADD COLUMN "autosave" boolean;
  CREATE INDEX "_articles_v_autosave_idx" ON "_articles_v" USING btree ("autosave");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX "_articles_v_autosave_idx";
  ALTER TABLE "_articles_v" DROP COLUMN "autosave";`)
}
