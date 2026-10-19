import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Whoever has published work has a public profile (src/lib/review-hooks.ts
 * does it on each approval from now on): authors of published articles,
 * fellows of published courses and editors of published publications are
 * shown on the site.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "people" SET "visible" = true WHERE "visible" IS NOT TRUE AND "id" IN (
      SELECT r."people_id" FROM "articles_rels" r JOIN "articles" a ON a."id" = r."parent_id"
        WHERE r."path" = 'authors' AND a."_status" = 'published'
      UNION SELECT r."people_id" FROM "courses_rels" r JOIN "courses" x ON x."id" = r."parent_id"
        WHERE r."path" = 'fellows' AND x."_status" = 'published'
      UNION SELECT r."people_id" FROM "publications_rels" r JOIN "publications" x ON x."id" = r."parent_id"
        WHERE r."path" = 'editors' AND x."_status" = 'published')`)
}

export async function down(_args: MigrateDownArgs): Promise<void> {
  // Which people were hidden before is not recorded; an admin can hide one again.
}
