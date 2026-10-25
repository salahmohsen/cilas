import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" ADD COLUMN "course_session" varchar;
  ALTER TABLE "_space_posts_v" ADD COLUMN "version_course_session" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "space_posts" DROP COLUMN "course_session";
  ALTER TABLE "_space_posts_v" DROP COLUMN "version_course_session";`)
}
