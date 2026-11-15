import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sessions_meetings" ADD COLUMN "approximate" boolean DEFAULT false;
  ALTER TABLE "_sessions_v_version_meetings" ADD COLUMN "approximate" boolean DEFAULT false;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "sessions_meetings" DROP COLUMN "approximate";
  ALTER TABLE "_sessions_v_version_meetings" DROP COLUMN "approximate";`)
}
